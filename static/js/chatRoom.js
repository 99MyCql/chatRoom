$(function() {

    // 初始化变量
    var $window = $(window);
    var $messages = $('.messages');         // 消息显示的区域
    var $inputMessage = $('#inputMessage'); // 输入消息的区域
    var connected = false;  // 用来判断是否连接的标志

    $inputMessage.focus();  // 首先聚焦到输入框

    // 点击输入框时，聚焦到输入框
    $inputMessage.click(function () {
        $inputMessage.focus();
    });

    // 创建一个webSocket连接
    var socket = new WebSocket('ws://'+window.location.host+'/chatRoom/join?name=' + $('#name').text());

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

    //=======================消息显示===========================
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
            var $usernameDiv = $('<span class="username"/>')
                    .text(name)
                    .css('color', getUsernameColor(name));
            var $messageBodyDiv = $('<span class="messageBody">')
                    .text(msg);
            $messageDiv = $('<li class="message"/>')
                    .data('username', name)
                    .append($usernameDiv, $messageBodyDiv);
        }
        // type为1或2表示有人加入或退出
        else {
            var $messageBodyDiv = $('<span class="messageBody">')
                    .text(msg);
            $messageDiv = $('<li style="text-align:center;color:#999999;font-size:15px;"/>')
                    .append($messageBodyDiv);
        }

        $messages.append($messageDiv);
        $messages[0].scrollTop = $messages[0].scrollHeight;
    }

    var COLORS = [
        '#e21400', '#91580f', '#f8a700', '#f78b00',
        '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
        '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
    ];
    // 通过一个hash函数得到用户名的颜色
    function getUsernameColor (username) {
        // Compute hash code
        var hash = 7;
        for (var i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + (hash << 5) - hash;
        }
        // Calculate color
        var index = Math.abs(hash % COLORS.length);
        return COLORS[index];
    }

    //========================消息发送==========================
    // 当回车键敲下
    $window.keydown(function (event) {
        // 13是回车的键位
        if (event.which === 13) {
            sendMessage();
            typing = false;
        }
    });

    // 通过webSocket发送消息到服务端
    function sendMessage () {
        var message = $inputMessage.val();  // 获取输入框的值

        if (message && connected) {
            $inputMessage.val('');      // 情况输入框的值
            socket.send(message);
            console.log("send message:" + message);
        }
    }
});
