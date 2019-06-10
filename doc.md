## 用beego实现聊天室(WebSocket方式)

### 前言

刚入门`go`语言和`beego`框架，通过一个简单聊天室的实现，来趁热练习。

### WebSocket协议

在实现之前，我们需要解决一个底层问题。

总所周知，`HTTP协议`是单向传输协议，只能由客户端**主动**向服务端发送信息，反之则不行。而在聊天室中，一个用户发送一条消息，服务器则需要将该条消息广播到聊天室中的所有用户，这想通过HTTP协议实现是不可能的。

除非，让每个用户每隔一段时间便请求一次服务器获取新消息。这种方式称为**长轮询**。但其缺点十分明显，非常消耗资源。

为了解决这个问题，`WebSocket协议`应运而生。

那什么是`WebSocket协议`呢？[百度百科](https://baike.baidu.com/item/WebSocket/1953845?fr=aladdin)

`WebSocket协议`与`HTTP协议`同属于应用层协议。不同的是，`WebSocket`是双向传输协议，弥补了这个缺点，在该协议下，**服务端也能主动向客户端发送信息**。同时，一旦连接，客户端会与服务端保持长时间的通讯。

`WebSocket协议`的标识符是`ws`，如：`ws://localhost:8080/chatRoom/WS`

### go语言并发特性

`go`语言的一大特性，便是内置的并发功能(`goroutine`)。以及，在并发个体之间传递数据的“通道”(`chan`)。

具体细节不在此赘述。

### beego框架

一个开源的轻量级`web server`框架，实现了典型的`MVC`模型，和先进的`api`接口模型(前后端分离模型)。

聊天室的实现，便基于其`MVC`模型。

### 实现步骤

#### 需求分析

##### 数据分析

聊天室中主要物体分为两种：用户和消息。

用户的主要属性为：姓名、客户端与服务端之间的`WebSocket`连接指针。

消息则分为三种：用户发消息、有用户加入、有用户离开。若将加入和离开也视为用户发出的消息内容，那消息的主要属性就有：消息类型、消息内容、发消息者。

##### 功能分析

前端：

- 实现与服务端的`WebSocket`连接。

后端：

- 提供`WebSocket`连接接口。与实现`HTTP`连接接口一样，利用`beego`框架即可。

- 当新用户建立连接时、用户断开连接时、收到连接中用户发来的新信息时，能将消息广播给所有连接用户。

客户端(即前端js)若要与服务端建立`WebSocket`连接，需要调用`WebSocket`连接API，详细内容见[大神博客](https://blog.csdn.net/wangzhanzheng/article/details/78603532)。

服务端(即后端go)实现

#### 数据结构

用户：

```go
type Client struct {
    conn *websocket.Conn    // 用户websocket连接
    name string             // 用户名称
}
```

消息：

```go
// 1.设置为公开属性(即首字母大写)，是因为属性值私有时，外包的函数无法使用或访问该属性值(如：json.Marshal())
// 2.`json:"name"` 是为了在对该结构类型进行json编码时，自定义该属性的名称
type Message struct {
    EventType byte  `json:"type"`       // 0表示用户发布消息；1表示用户进入；2表示用户退出
    Name string     `json:"name"`       // 用户名称
    Message string  `json:"message"`    // 消息内容
}
```

用户组：

```go
clients = make(map [Client] bool)      // 用户组映射
```

此处使用映射而不是数组，是为了方便判断某个用户是否已经加入或者已经退出了。

用于`goroutine`通道：

```go
// 此处要设置有缓冲的通道。因为这是goroutine自己从通道中发送并接受数据。
// 若是无缓冲的通道，该goroutine发送数据到通道后就被锁定，需要数据被接受后才能解锁，而恰恰接受数据的又只能是它自己
join = make(chan Client, 10)        // 用户加入通道
leave = make(chan Client, 10)       // 用户退出通道
message = make(chan Message, 10)    // 消息通道
```

#### 功能实现

##### 前端`WebSocket`连接实现：

```js
//====================webSocket连接======================
// 创建一个webSocket连接
var socket = new WebSocket('ws://'+window.location.host+'/chatRoom/WS?name=' + $('#name').text());

// 当webSocket连接成功的回调函数
socket.onopen = function () {
    console.log("webSocket open");
    connected = true;
};

// 断开webSocket连接的回调函数
socket.onclose = function () {
    console.log("webSocket close");
    connected = false;
};
```

```js
//=======================接收消息并显示===========================
// 接受webSocket连接中，来自服务端的消息
socket.onmessage = function(event) {
    // 将服务端发送来的消息进行json解析
    var data = JSON.parse(event.data);
    console.log("revice:" , data);

    var name = data.name;
    var type = data.type;
    var msg = data.message;

    // type为0表示有人发消息
    var $messageDiv;
    if (type == 0) {
        var $usernameDiv = $('<span style="margin-right: 15px;font-weight: 700;overflow: hidden;text-align: right;"/>')
                .text(name);
        if (name == $("#name").text()) {
            $usernameDiv.css('color', nameColor);
        } else {
            $usernameDiv.css('color', getUsernameColor(name));
        }
        var $messageBodyDiv = $('<span style="color: gray;"/>')
                .text(msg);
        $messageDiv = $('<li style="list-style-type:none;font-size:25px;"/>')
                .data('username', name)
                .append($usernameDiv, $messageBodyDiv);
    }
    // type为1或2表示有人加入或退出
    else {
        var $messageBodyDiv = $('<span style="color:#999999;">')
                .text(msg);
        $messageDiv = $('<li style="list-style-type:none;font-size:15px;text-align:center;"/>')
                .append($messageBodyDiv);
    }

    $messageArea.append($messageDiv);
    $messageArea[0].scrollTop = $messageArea[0].scrollHeight;   // 让屏幕滚动
}
```

```js
//========================发送消息==========================
// 通过webSocket发送消息到服务端
function sendMessage () {
    var inputMessage = $inputArea.val();  // 获取输入框的值

    if (inputMessage && connected) {
        $inputArea.val('');      // 清空输入框的值
        socket.send(inputMessage);  // 基于WebSocket连接发送消息
        console.log("send message:" + inputMessage);
    }
}
```

##### 后端`WebSocket`连接接口

继承`beego`框架的`Controller`类型：

```go
type ServerController struct {
    beego.Controller
}
```

编写`ServerController`类型中用于`WebSocket`连接的方法：

```go
// 用于与用户间的websocket连接(chatRoom.html发送来的websocket请求)
func (c *ServerController) WS() {
    name := c.GetString("name")
    if len(name) == 0 {
        beego.Error("name is NULL")
        c.Redirect("/", 302)
        return
    }

    // 检验http头中upgrader属性，若为websocket，则将http协议升级为websocket协议
    conn, err := (&websocket.Upgrader{}).Upgrade(c.Ctx.ResponseWriter, c.Ctx.Request, nil)

    if _, ok := err.(websocket.HandshakeError); ok {
        beego.Error("Not a websocket connection")
        http.Error(c.Ctx.ResponseWriter, "Not a websocket handshake", 400)
        return
    } else if err != nil {
        beego.Error("Cannot setup WebSocket connection:", err)
        return
    }

    var client Client
    client.name = name
    client.conn = conn

    // 如果用户列表中没有该用户
    if !clients[client] {
        join <- client
        beego.Info("user:", client.name, "websocket connect success!")
    }

    // 当函数返回时，将该用户加入退出通道，并断开用户连接
    defer func() {
        leave <- client
        client.conn.Close()
    }()

    // 由于WebSocket一旦连接，便可以保持长时间通讯，则该接口函数可以一直运行下去，直到连接断开
    for {
        // 读取消息。如果连接断开，则会返回错误
        _, msgStr, err := client.conn.ReadMessage()

        // 如果返回错误，就退出循环
        if err != nil {
            break
        }

        beego.Info("WS-----------receive: "+string(msgStr))

        // 如果没有错误，则把用户发送的信息放入message通道中
        var msg Message
        msg.Name = client.name
        msg.EventType = 0
        msg.Message = string(msgStr)
        message <- msg
    }
}
```

##### 后端广播功能

将发消息、用户加入、用户退出三种情况都广播给所有用户。后两种情况经过处理，转换为第一种情况。真正发送信息给客户端的，只有第一种情况。

```go
func broadcaster() {
    for {
        // 哪个case可以执行，则转入到该case。若都不可执行，则堵塞。
        select {
            // 消息通道中有消息则执行，否则堵塞
            case msg := <-message:
                str := fmt.Sprintf("broadcaster-----------%s send message: %s\n", msg.Name, msg.Message)
                beego.Info(str)
                // 将某个用户发出的消息发送给所有用户
                for client := range clients {
                    // 将数据编码成json形式，data是[]byte类型
                    // json.Marshal()只会编码结构体中公开的属性(即大写字母开头的属性)
                    data, err := json.Marshal(msg)
                    if err != nil {
                        beego.Error("Fail to marshal message:", err)
                        return
                    }
                    // fmt.Println("=======the json message is", string(data))	// 转换成字符串类型便于查看
                    if client.conn.WriteMessage(websocket.TextMessage, data) != nil {
                        beego.Error("Fail to write message")
                    }
                }

            // 有用户加入
            case client := <-join:
                str := fmt.Sprintf("broadcaster-----------%s join in the chat room\n", client.name)
                beego.Info(str)

                clients[client] = true	// 将用户加入映射

                // 将用户加入消息放入消息通道
                var msg Message
                msg.Name = client.name
                msg.EventType = 1
                msg.Message = fmt.Sprintf("%s join in, there are %d preson in room", client.name, len(clients))

                // 此处要设置有缓冲的通道。因为这是goroutine自己从通道中发送并接受数据。
                // 若是无缓冲的通道，该goroutine发送数据到通道后就被锁定，需要数据被接受后才能解锁，而恰恰接受数据的又只能是它自己
                message <- msg

            // 有用户退出
            case client := <-leave:
                str := fmt.Sprintf("broadcaster-----------%s leave the chat room\n", client.name)
                beego.Info(str)

                // 如果该用户已经被删除
                if !clients[client] {
                    beego.Info("the client had leaved, client's name:"+client.name)
                    break
                }

                delete(clients, client)	// 将用户从映射中删除

                // 将用户退出消息放入消息通道
                var msg Message
                msg.Name = client.name
                msg.EventType = 2
                msg.Message = fmt.Sprintf("%s leave, there are %d preson in room", client.name, len(clients))
                message <- msg
        }
    }
}
```

在后端服务启动时，便开启广播功能：

```go
func init() {
    go broadcaster()
}
```

此处需要利用`goroutine`并发模式，使得该函数能独立在额外的一个线程上运作。

### 参考文档

- [Golang实战-一个聊天室的实现](https://blog.csdn.net/aslackers/article/details/72466730)

- [beego官网聊天室样例](https://github.com/beego/samples/tree/master/WebIM)

- [[实战]基于Go实现Web聊天室(3种方式)](https://www.jianshu.com/p/f0b7b832cc22)
