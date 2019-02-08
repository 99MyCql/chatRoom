$(function() {

    //=========================初始化====================================
    var $window = $(window);
    var $messageArea = $('#messageArea');       // 消息显示的区域
    var $inputArea = $('#inputArea');           // 输入消息的区域
    $inputArea.focus();  // 首先聚焦到输入框
    var connected = false;                      // 用来判断是否连接的标志

    // 通过一个hash函数得到用户名的颜色
    function getUsernameColor (username) {
        var COLORS = [
            '#e21400', '#91580f', '#f8a700', '#f78b00',
            '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
            '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
        ];
        // Compute hash code
        var hash = 7;
        for (var i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + (hash << 5) - hash;
        }
        // Calculate color
        var index = Math.abs(hash % COLORS.length);
        return COLORS[index];
    }

    // 初始化显示的名字颜色
    var nameColor = getUsernameColor( $("#name").text());
    $("#name").css('color', nameColor);


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

    //========================发送消息==========================
    // 当回车键敲下
    $window.keydown(function (event) {
        // 13是回车的键位
        if (event.which === 13) {
            sendMessage();
            typing = false;
        }
    });

    // 发送按钮点击事件
    $("#sendBtn").click(function () {
        sendMessage();
    });

    // 通过webSocket发送消息到服务端
    function sendMessage () {
        var inputMessage = $inputArea.val();  // 获取输入框的值

        if (inputMessage && connected) {
            $inputArea.val('');      // 清空输入框的值
            socket.send(inputMessage);  // 基于WebSocket连接发送消息
            console.log("send message:" + inputMessage);
        }
    }
});
