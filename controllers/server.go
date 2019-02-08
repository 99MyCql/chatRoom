package controllers

import (
	"net/http"

	"github.com/astaxie/beego"
	"github.com/gorilla/websocket"
)

type ServerController struct {
	beego.Controller
}

func (c *ServerController) Get()  {
	name := c.GetString("name")
	if len(name) == 0 {
		beego.Error("name is NULL")
		c.Redirect("/", 302)
		return
	}

	beego.Info("get name:"+name+", and send to chatRoom.html")
	c.Data["name"] = name
	c.TplName = "chatRoom.html"
}

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

		//如果没有错误，则把用户发送的信息放入message通道中
		var msg Message
		msg.Name = client.name
		msg.EventType = 0
		msg.Message = string(msgStr)
		message <- msg
	}
}