package routers

import (
	"github.com/99MyCql/chatRoom/controllers"
	"github.com/astaxie/beego"
)

func init() {
	beego.Router("/", &controllers.MainController{})
	beego.Router("/chatRoom", &controllers.ServerController{})
	beego.Router("/chatRoom/join", &controllers.ServerController{}, "get:Handle")
}
