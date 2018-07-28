import request from 'request'
import config from '../config'
import jwt from '../common/jwtauth'
import WXBizDataCrypt from '../common/WXBizDataCrypt'
import proxy from '../proxy'
import jwtauth from '../middlewares/jwtauth'
/**
 * Object.assign是ES6新添加的接口，主要用途是用来合并多个JS对象，assign方法将多个原对象的属性和方法合并到目标对象上面
 * 如果在这个过程中出现同名的属性或方法，会覆盖原来的属性和方法
 * Object.assign是浅拷贝，也就说，如果拷贝过来的属性的值是对象等复合属性，那么只能拷贝过来一个引用
 * 由于是浅拷贝，所以拷贝过来的对象的引用的对象内部发生变化都会在目标对象上面呈现出来
 * 
 * 
 * proxy.user是数据库表document的代理类，即对数据库操作的封装，包括新增数据与查询等方法
 */
class Ctrl{
	constructor(app) {
		Object.assign(this, {
			app, 
			model: proxy.user, 
		})

		this.init()
	}

	/**
	 * 初始化
	 */
	init() {
		this.routes()
		this.initSuperAdmin()
	}

	/**
	 * 注册路由
	 * 
	 * 回调函数后面的bind(this)是改变this的指向，如果不改变的话，在回调函数内部使用this指向的是回调函数返回的上下文对象，
	 * 通过bind(this)方法可以是this指向当前外层的this，如果不用bind(this),就使用var that=this
	 * 
	 * wechatDecryptData解密微信数据
	 * 小程序使用wx.getUserInfo()获取到用户信息，包括昵称、头像、省份、城市等，一般情况下使用这些资料就够了，
	 * 但是对于一个公司有很多个小程序，或者公司的小程序与公众号关联时，为了让用户一次授权就能在所有自己的小程序和
	 * 公众号上面使用，需要用到unionId。小程序getUserInfo()接口除了能过获得用户的普通信息外，还会返回一个加密内容decryptData，
	 * 这个unionId就是保存在decryptData里面，需要解码才能获得到
	 */
	routes() {
		this.app.post('/api/user/wechat/sign/up', this.wechatSignUp.bind(this))
		this.app.post('/api/user/wechat/sign/in', this.wechatSignIn.bind(this))
		this.app.post('/api/user/wechat/decrypt/data', this.wechatDecryptData.bind(this))
		this.app.post('/api/user/sign/up', this.signUp.bind(this))
		this.app.post('/api/user/sign/in', this.signIn.bind(this))
		this.app.post('/api/user/sign/out', this.signOut.bind(this))
		this.app.post('/api/user/reset/password', this.resetPassword.bind(this))
		this.app.post('/api/user/info', this.saveInfo.bind(this))
		this.app.get('/api/user/info', this.getInfo.bind(this))
	}

	/**
	 * 封装request请求
	 */
	requestAsync(url) {
		return new Promise((reslove, reject) => {
			request({url: url}, (err, res, body) => {
				if (err) return reject(err)
				return reslove(body)
			})
		})
	}

	/**
	 * 服务端拿着终端从微信获取的临时访问令牌code再调用微信的接口（携带appid、secret和code）换取session_key
	 */
	getSessionKey(code) {
		const appid = config.wechat.appid
		const secret = config.wechat.secret
		const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
		return this.requestAsync(url)
	}

	/**
	 * @api {post} /user/wechat/sign/up 微信用户注册
	 * @apiDescription 微信用户注册
	 * @apiName wechatSignUp
	 * @apiGroup user
	 *
	 * @apiParam {String} code 登录凭证
	 *
	 * @apiPermission none
	 * @apiSampleRequest /user/wechat/sign/up
	 * 
	 * @apiUse Success
	 *
	 * @apiSuccessExample Success-Response:
	 *     HTTP/1.1 200 OK
	 *     {
	 *       "meta": {
	 *       	"code": 0,
	 *       	"message": "注册成功"
	 *       },
	 *       "data": {
	 *       	"token": "token"
	 *       }
	 *     }
	 * 微信注册：通过微信获取到的用户openId来注册到业务服务器中
	 */
	wechatSignUp(req, res, next) {
		const code = req.body.code
		const body = {
			username: null, 
			password: res.jwt.setMd5('123456'),//res的jwt方法通过中间件获得 
		}

		this.getSessionKey(code)
		.then(doc => {
			doc = JSON.parse(doc)
			if (doc && doc.errmsg) return res.tools.setJson(doc.errcode, doc.errmsg)//res.tools提供了对返回数据的json封装工具，通过中间件追加到res上面去的
			if (doc && doc.openid) {
				body.username = doc.openid//openId映射到数据库中的username
				return this.model.findByName(doc.openid)//注册的时候先去库里查看用户有没有存在，因为拿着openId去查询username
			}
		})
		.then(doc => {
			if (!doc) return this.model.newAndSave(body)
			if (doc && doc._id) return res.tools.setJson(1, '用户名已存在')
		})
		.then(doc => {
			if (doc && doc._id) return res.tools.setJson(0, '注册成功', {
			
				//   用mongod的user表总的用户_id通过jwt生成token
				//   客户端请求时，服务端可以通过jwt中间件使用token解出id(取出掉ObjectId)
			
				token: res.jwt.setToken(doc._id)
			})
		})
		.catch(err => next(err))
	}

	/**
	 * @api {post} /user/wechat/sign/in 微信用户登录
	 * @apiDescription 微信用户登录
	 * @apiName wechatSignIn
	 * @apiGroup user
	 *
	 * @apiParam {String} code 登录凭证
	 *
	 * @apiPermission none
	 * @apiSampleRequest /user/wechat/sign/in
	 * 
	 * @apiUse Success
	 *
	 * @apiSuccessExample Success-Response:
	 *     HTTP/1.1 200 OK
	 *     {
	 *       "meta": {
	 *       	"code": 0,
	 *       	"message": "登录成功"
	 *       },
	 *       "data": {
	 *       	"token": "token"
	 *       }
	 *     }
	 */
	wechatSignIn(req, res, next) {
		const code = req.body.code

		this.getSessionKey(code)
		.then(doc => {
			/**
			 * 调用微信登录的时候通过getSessionKey(code)拿到openId和session_key，我们拿着openId去查库,在注册的时候
			 * openId映射到user表中的username，所以拿着openId去查看有没有该用户，没有就返回错误，客户端收到错误后调用
			 * 注册接口，服务端再去执行注册方法。有的话就要返回给客户端token了，登录的主要目的就是返回给客户端一个token，
			 * 这个token的生成规则可以自己指定，这里我们是将user表中的对象_id:ObjectId("xxxx")通过jwt生成token，如果是
			 * 用用户名和密码登录，那么就可以将用户名和密码通过jwt来生成token。之后的请求，客户端header带token（Authorization）
			 * 去请求，服务端拿到token后通过JWT解出_id，然后就可以查库后拿到用户信息，（实际上通过中间件拿到用户信息后把它放到了
			 * req里面这样的话相当于无论哪个请求都是携带了用户信息的，这样的话，无论哪个接口业务需要用户信息都不用再去查询，直接用就可以了
			 * 在这里这个用户信息是又去库里查到的，所以会有服务器存储压力，如果对于不 重要的用户信息其实可以直接放到token
			 * 里面去）。
			 * 同时可见获取的openId(映射到了user表中的username)可以用来在用户登录的时候查看用户是否存在，即是否已经在我们的
			 * 业务服务器中注册过。
			 * 
			 * 所以要理清一点就是在我们的业务中openId和_id(用来生成token)的不同应用场景，openId是用来检查用户是否存在-点击登录，
			 * 而_id用来匹配token从而验证用户登录状态（即通过token是否能在库中拿到_id,拿不到说明token过期或者token被篡改)
			 * 
			 * token说白就是让每个请求携带用户信息(登录状态下)，我们的应用只有在查看个人中心以及购物等的的时候才检测登录状态，
			 * 首页无需登录
			 * 
			 * 实际上在上述服务器拿到token后，会先去redis里面匹配token，匹配的结果中有一种就是token过期，如果匹配到token，
			 * 并且有效，再去获取用户信息，详细细节查看jwtauth.js
			 * 
			 * ObjectId：存储在mongodb集合中的每一个文档(document)都有一个默认主键，这个主键名称是固定的，它可以是mongodb支持
			 * 的任何数据类型，默认是ObjectId。
			 * ObjectId是一个由12字节的BSON类型字符串。按照字节顺序，依次代表：
			 * 4字节：UNIX时间戳
			 * 3字节：表示运行MongoDB的机器
			 * 2字节：表示生成次_id的进程
			 * 1字节：由随机数开始的计数器生成的值
			 */
			doc = JSON.parse(doc)
			if (doc && doc.errmsg) return res.tools.setJson(doc.errcode, doc.errmsg)
			if (doc && doc.openid) return this.model.findByName(doc.openid)
		})
		.then(doc => {
			if (!doc) return res.tools.setJson(1, '用户名不存在')
			if (doc && doc._id) return res.tools.setJson(0, '登录成功', {
				token: res.jwt.setToken(doc._id)
			})
		})
		.catch(err => next(err))
	}


	/**
	 * @api {post} /user/wechat/decrypt/data 微信用户信息的数据解密
	 * @apiDescription 微信用户登录
	 * @apiName wechatDecryptData
	 * @apiGroup user
	 *
	 * @apiParam {String} code 登录凭证
	 * @apiParam {String} encryptedData 包括敏感数据在内的完整用户信息的加密数据
	 * @apiParam {String} iv 加密算法的初始向量
	 * @apiParam {String} rawData 不包括敏感信息的原始数据字符串，用于计算签名
	 * @apiParam {String} signature 使用 sha1( rawData + sessionkey ) 得到字符串，用于校验用户信息
	 *
	 * @apiPermission none
	 * @apiSampleRequest /user/wechat/decrypt/data
	 * 
	 * @apiUse Success
	 *
	 * @apiSuccessExample Success-Response:
	 *     HTTP/1.1 200 OK
	 *     {
	 *       "meta": {
	 *       	"code": 0,
	 *       	"message": "登录成功"
	 *       },
	 *       "data": {
	 *       	"token": "token"
	 *       }
	 *     }
	 */
	wechatDecryptData(req, res, next) {
		const encryptedData = req.body.encryptedData
		const iv = req.body.iv
		const rawData = req.body.rawData
		const signature = req.body.signature
		const code = req.body.code
		const appid = config.wechat.appid

		this.getSessionKey(code)
		.then(doc => {
			doc = JSON.parse(doc)
			if (doc.errmsg) return res.tools.setJson(doc.errcode, doc.errmsg)
			if (doc.openid) {
				const pc = new WXBizDataCrypt(appid, doc.session_key)
				const data = pc.decryptData(encryptedData , iv)
				return res.tools.setJson(0, '调用成功', data)
			}
		})
		.catch(err => next(err))
	}

	/**
	 * 创建超级管理员
	 */
	initSuperAdmin(req, res, next) {
		const username = config.superAdmin.username
		const password = config.superAdmin.password

		this.model.findByName(username)
		.then(doc => {
			if (!doc) return this.model.newAndSave({
				username: username, 
				password: jwt.setMd5(password), 
			})
		})
	}

	/**
	 * @api {post} /user/sign/up 用户注册
	 * @apiDescription 用户注册
	 * @apiName signUp
	 * @apiGroup user
	 *
	 * @apiParam {String} username 用户名
	 * @apiParam {String} password 密码
	 *
	 * @apiPermission none
	 * @apiSampleRequest /user/sign/up
	 * 
	 * @apiUse Success
	 *
	 * @apiSuccessExample Success-Response:
	 *     HTTP/1.1 200 OK
	 *     {
	 *       "meta": {
	 *       	"code": 0,
	 *       	"message": "注册成功"
	 *       },
	 *       "data": null
	 *     }
	 */
	signUp(req, res, next) {
		const username = req.body.username
		const password = req.body.password

		if (!username || !password) return res.tools.setJson(1, '用户名或密码错误')
		
		this.model.findByName(username)
		.then(doc => {
			if (!doc) return this.model.newAndSave({
				username: username, 
				password: res.jwt.setMd5(password)
			})
			return res.tools.setJson(1, '用户名已存在')
		})
		.then(doc => res.tools.setJson(0, '注册成功'))
		.catch(err => next(err))
	}

	/**
	 * @api {post} /user/sign/in 用户登录
	 * @apiDescription 用户登录
	 * @apiName signIn
	 * @apiGroup user
	 *
	 * @apiParam {String} username 用户名
	 * @apiParam {String} password 密码
	 *
	 * @apiPermission none
	 * @apiSampleRequest /user/sign/in
	 * 
	 * @apiUse Success
	 *
	 * @apiSuccessExample Success-Response:
	 *     HTTP/1.1 200 OK
	 *     {
	 *       "meta": {
	 *       	"code": 0,
	 *       	"message": "登录成功"
	 *       },
	 *       "data": {
	 *       	"token": "token"
	 *       }
	 *     }
	 */
	signIn(req, res, next) {
		const username = req.body.username
		const password = req.body.password
		
		if (!username || !password) return res.tools.setJson(1, '用户名或密码错误')	
		if (req.body.code !== req.session.code) return res.tools.setJson(1, '验证码错误')

		this.model.model.getAuthenticated(username, password)
		.then(doc => {
			switch (doc) {
	            case 0:
	            	res.tools.setJson(1, '用户名或密码错误')
	            	break
	            case 1:
	                res.tools.setJson(1, '用户名或密码错误')
	                break
	            case 2:
	                res.tools.setJson(1, '账号已被锁定，请等待两小时解锁后重新尝试登录')
	                break
	            default: res.tools.setJson(0, '登录成功', {
					token: res.jwt.setToken(doc._id)
				})
	        }
		})
		.catch(err => next(err))	
	}

	/**
	 * @api {post} /user/sign/out 用户登出
	 * @apiDescription 用户登出
	 * @apiName signOut
	 * @apiGroup user
	 *
	 * @apiPermission none
	 * @apiSampleRequest /user/sign/out
	 * 
	 * @apiUse Header
	 * @apiUse Success
	 *
	 * @apiSuccessExample Success-Response:
	 *     HTTP/1.1 200 OK
	 *     {
	 *       "meta": {
	 *       	"code": 0,
	 *       	"message": "登出成功"
	 *       },
	 *       "data": null
	 *     }
	 */
	signOut(req, res, next) {
		if (req.user) {
			new jwtauth().expireToken(req.headers)
			delete req.user	
			delete this.app.locals.token
			return res.tools.setJson(0, '登出成功')
		}
		return res.tools.setJson(1, '登出失败')
	}

	/**
	 * @api {post} /user/reset/password 修改密码
	 * @apiDescription 修改密码
	 * @apiName resetPassword
	 * @apiGroup user
	 *
	 * @apiParam {String} oldpwd 旧密码
	 * @apiParam {String} newpwd 新密码
	 * 
	 * @apiPermission none
	 * @apiSampleRequest /user/reset/password
	 * 
	 * @apiUse Header
	 * @apiUse Success
	 *
	 * @apiSuccessExample Success-Response:
	 *     HTTP/1.1 200 OK
	 *     {
	 *       "meta": {
	 *       	"code": 0,
	 *       	"message": "更新成功"
	 *       },
	 *       "data": null
	 *     }
	 */
	resetPassword(req, res, next) {
		const oldpwd = req.body.oldpwd
		const newpwd = req.body.newpwd
			
		if (oldpwd && newpwd) {
			this.model.findByName(req.user.username)
			.then(doc => {
				if (!doc) return res.tools.setJson(1, '用户不存在或已删除')
				if (doc.password !== res.jwt.setMd5(oldpwd)) return res.tools.setJson(1, '密码错误')
				doc.password = res.jwt.setMd5(newpwd)
				return doc.save()
			})
			.then(doc => res.tools.setJson(0, '更新成功'))
			.catch(err => next(err))
		}
	}

	/**
	 * @api {post} /user/info 保存用户信息
	 * @apiDescription 保存用户信息
	 * @apiName saveInfo
	 * @apiGroup user
	 *
	 * @apiParam {Date} birthday 生日
	 * @apiParam {String} email 邮箱
	 * @apiParam {String} gender 性别
	 * @apiParam {String} avatar 头像
	 * @apiParam {String} nickname 昵称
	 * @apiParam {String} tel 手机
	 * 
	 * @apiPermission none
	 * @apiSampleRequest /user/info
	 * 
	 * @apiUse Header
	 * @apiUse Success
	 *
	 * @apiSuccessExample Success-Response:
	 *     HTTP/1.1 200 OK
	 *     {
	 *       "meta": {
	 *       	"code": 0,
	 *       	"message": "更新成功"
	 *       },
	 *       "data": {}
	 *     }
	 */
	saveInfo(req, res, next) {
		this.model.findByName(req.user.username)
		.then(doc => {
			if (!doc) return res.tools.setJson(1, '用户不存在或已删除')

			for(let key in req.body) {
				doc[key] = req.body[key]
			}

			doc.update_at = Date.now()

			return doc.save()
		})
		.then(doc => res.tools.setJson(0, '更新成功', doc))
		.catch(err => next(err))
	}

	/**
	 * @api {get} /user/info 获取用户信息
	 * @apiDescription 获取用户信息
	 * @apiName getInfo
	 * @apiGroup user
	 * 
	 * @apiPermission none
	 * @apiSampleRequest /user/info
	 * 
	 * @apiUse Header
	 * @apiUse Success
	 *
	 * @apiSuccessExample Success-Response:
	 *     HTTP/1.1 200 OK
	 *     {
	 *       "meta": {
	 *       	"code": 0,
	 *       	"message": "调用成功"
	 *       },
	 *       "data": {}
	 *     }
	 */
	getInfo(req, res, next) {
		this.model.findByName(req.user.username)
		.then(doc => {
			if (!doc) return res.tools.setJson(1, '用户不存在或已删除')
			return res.tools.setJson(0, '调用成功', doc)
		})
		.catch(err => next(err))
	}
}

export default Ctrl