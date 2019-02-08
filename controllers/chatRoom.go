package controllers

import (
	"fmt"
	"encoding/json"
	_ "net/http"

	"github.com/astaxie/beego"
	"github.com/gorilla/websocket"
)

type Client struct {
	conn *websocket.Conn	// 用户websocket连接
	name string				// 用户名称
}

// 1.设置为公开属性(即首字母大写)，是因为属性值私有时，外包的函数无法使用或访问该属性值(如：json.Marshal())
// 2.`json:"name"` 是为了在对该结构类型进行json编码时，自定义该属性的名称
type Message struct {
	EventType byte	`json:"type"`		// 0表示用户发布消息；1表示用户进入；2表示用户退出
	Name string		`json:"name"`		// 用户名称
	Message string	`json:"message"`	// 消息
}

var (
	// 此处要设置有缓冲的通道。因为这是goroutine自己从通道中发送并接受数据。
	// 若是无缓冲的通道，该goroutine发送数据到通道后就被锁定，需要数据被接受后才能解锁，而恰恰接受数据的又只能是它自己
	join = make(chan Client, 10)			// 用户加入通道
	leave = make(chan Client, 10)			// 用户退出通道
	message = make(chan Message, 10)		// 消息通道
	clients = make(map [Client] bool)		// 用户映射
)

func init() {
	go broadcaster()
}

// 广播
func broadcaster() {
	for {
		// 哪个case可以执行，则转入到该case。都不可执行，则堵塞。
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
