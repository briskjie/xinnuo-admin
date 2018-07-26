import express from 'express'
import exphbs from 'express-handlebars'
import path from 'path'
import favicon from 'serve-favicon'
import log4js from 'log4js'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import cors from 'cors'//实现跨域请求
import connect from 'connect'
import jwt from 'express-jwt'
import sessionMongoose from 'session-mongoose'

import mongo from './db/mongo'
import config from './config'
import mkdirs from './common/mkdirs'
import logger from './common/logger'
import tools from './middlewares/tools'
import jwtauth from './middlewares/jwtauth'
import routes from './routes'

const app          = express()
const mkdirsSync   = mkdirs.mkdirsSync
const SessionStore = sessionMongoose(connect)
const mongodb      = new mongo(app, config)
const store        = new SessionStore({ url: mongodb.dblink })
const auth         = new jwtauth()

// 判断文件夹是否存在, 若不存在则创建之
mkdirsSync(config.upload.tmp)
mkdirsSync(config.upload.path)

/**
 * view engine setup express中使用模板引擎，可以使用handlebars/jade
 * 如果要在不同扩展名的文件中使用handlebars(如.html)
 * app.set('view engine','html')
 * app.engin('html',require('hbs')._express)
 */

app.set('view engine', 'hbs')//用hbs作为模板引擎
app.set('views', path.join(__dirname, 'views') )//设置模板所在的路径，__dirname指的是开发期间该行代码所在的目录，在这里也就是app.js的目录，也就是根目录，进而找到根目录下面的views目录
//配置模板引擎
app.engine('hbs', exphbs({
	layoutsDir: path.join(__dirname, 'views/layouts/'),//设置布局模板文件的目录
	defaultLayout: 'main',//设置默认的页面布局模板为main.hbs
	extname: '.hbs',//设置模板文件使用的后缀名称，这个.hbs是我们自定义的，也可以使用html,只需要把上面的.hbs全部替换掉
	helpers: {
		time: Date.now
	}
}))

//app.use()设置一些列的中间件
app.use(favicon(__dirname + '/public/favicon.ico'))//设置favicon图标

/**
 * log4js是nodejs的日志管理工具，可以将日志以各种形式输出到各种渠道
 */
app.use(log4js.connectLogger(logger('normal'), {level:'auto', format:':method :url :status'}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))//express托管静态文件,设置静态文件目录


/**
 * cookie-parser在用express生成器构建项目时自动安装的，它的作用就是设置，获取和安装cookie，express-session依赖于它
 * 
 * app.use(cookieParser())这种方式创建出的cookie的各种操作都是未签名的，签名可以提高安全性
 * app.use(cookieParser('sss)),这种方式创建时签名的,用一个自定义的字符串'sss'来作为secret
 * 
 * 
 * express对session cookie的处理很有意思，就是这两个cookie-parser和express-session模块，依赖关系很微妙
 */
app.use(cookieParser(config.secret))//挂载中间件，可以理解为实例化

// set session.
app.use(session({
	store: store,
	cookie: {
		maxAge: 60000,
	},
	resave: false,//是指每次请求都重新设置session cookie,假设你的cookie十分钟过期，每次请求都会再设置10分钟
	saveUninitialized: true,//是指无论有没有session cookie，每次请求都设置session cookie，默认给个标示为connect.sid
	// secure:true,//设置在https
	secret: config.secret
}))

/**
 * 实现跨域请求，(jsonp只能get请求)
 * express写的接口只能内部使用，如果想要外部服务器访问，就涉及到跨域(浏览器有同源策略)
 * 这个代码一定要写在注册路由的前面，此模块也可以当作路由中间件，指定某一个或某一部分路由拥有跨域功能
 */
app.use(cors())


/**
 * 中间件分为系统级中间件和路由级中间件
 * 
 * 
 * 下面是设置系统级中间件，对所有的请求生效
 */
app.use((req, res, next) => {
	//url路径中没有api表示是管理后台请求，交给后台页面处理
	if(req.path.indexOf('/api') === -1) {
		return res.render('index')
	}
	return next()
})

// index
// app.get('/', (req, res) => {
// 	res.render('index')
// })



// custom middleware
/**
 * app.use(arg1,arg2)
 * arg1表示匹配的url
 * arg2表示使用的中间件
 *  /\/api/释义：正则中 /顺斜杠表示正则的开始和结束，\表示转义
 * 因此上面的意思就是匹配url中带有 /api的请求，然后使用中间件
 * 
 * 
 * tools中间件，装配分页插件(paginates.js)和返回指定数据格式
 * 的插件(common/tools.js)和用户认证插件JWT(用户生成加密token，并且负载
 * 可以携带非重要信息，譬如id，服务端可以通过token计算出id，而session需要存储
 * 会增加服务器存储压力)
 */
app.use(/\/api/, tools)

/**
 * 正则表达式中：
 * ():是为了提取匹配字符串的，表达式中有几个()就有几个相应的匹配字符串
 * 		如(\s*)表示连续空格的字符串
 * []定义匹配字符串的范围
 * {}定义匹配字符串的长度
 * [0-9]{0,9}:表示长度为0到9的数字字符串
 * 
 * ^:正则表达式匹配字符串开始的位置
 * $:正则表达式匹配字符串结束的位置
 * *:重复0次或多次
 * +:重复1次或多次
 * ?:重复0次或1次
 * {n}：重复n次
 * {n,}:重复至少n次
 * 
 * captcha:验证码
 * 匹配登录、退出、验证码然后通过JWT进行用户认证
 * 
 * 绑定的中间件只有请求时才触发操作
 */
app.use(/^((?!sign\/up|sign\/in|captcha).)+$/, [
	jwt({ secret: config.secret}), 
	auth.verifyToken.bind(auth)//通过中间件来验证token
])

// 加载路由
routes(app)

// catch 404 and forward to error handler
app.use((req, res, next) => {
	const err = new Error('Not Found')
	err.status = 404
	// res.status(404)
	// res.send('Not Found')
	next(err)
})

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use((err, req, res, next) => {
		console.log(err)
		res.status(err.status || 500)
		res.render('error', {
			layout: false,
			message: err.message,
			error: err
		})
	})
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
	res.status(err.status || 500)
	res.render('error', {
		layout: false,
		message: err.message,
		error: err
	})
})

// app.listen(3000, '0.0.0.0')

export default app