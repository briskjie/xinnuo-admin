import mongoose from 'mongoose'
import crypto from 'crypto'//crypto是一个加密模块，用于加密密码，当我们提交表单后，如果不把密码这些敏感信息处理下，会有很大风险

const MAX_LOGIN_ATTEMPTS = 5//最大登录次数
const LOCK_TIME          = 2 * 60 * 60 * 1000//超过登录次数失败后的锁住时间，此处为2小时

/**
 * Schema是图标的意思，在数据库中Schema为数据库对象的集合，一个用户一般对应一个Schema
 * 在数据库中会自动生成__v,表示版本号，如果我们不需要的话可以在Schema中加入{versionKey:false},即
 * mongoose.Schema({...},{versionKey:false})
 * 
 * mongoose相关知识查看Mongoose.db文档
 */
const Schema = mongoose.Schema({
	username : String,
	password : String,
	avatar   : String,
	tel      : Number,
	email    : String,
	nickname : String,
	gender   : String,
	birthday : Date,
	loginAttempts: { 
		type    : Number, 
		required: true, 
		default : 0, 
	},
    lockUntil: { 
    	type: Number, 
    },
	create_at: {
		type   : Date,
		default: Date.now(),
	},
	update_at: Date,
})

/**
 * 下面是通过Schema定义Model的静态常量(也可以定义静态方法，定义静态方法时不能使用es6的箭头函数)
 */
const reasons = Schema.statics.failedLogin = {
	NOT_FOUND         : 0,
	PASSWORD_INCORRECT: 1,
	MAX_ATTEMPTS      : 2,
}

Schema.virtual('isLocked').get(function() {
	/**
	 * '!'将后面的值强制转换为布尔值
	 * 
	 * 譬如 this.lockUntil为undefined时表示没上锁，期望输出结果应该是true
	 *  !this.lockUntil = true, !!this.lockUnitl = false 得到我们想要的结果
	 * this.lockUnitl=true且大于Data.now()->表示还没有到锁解除的时间时都是处于上锁状态
	 */
    return !!(this.lockUntil && this.lockUntil > Date.now())
})
/**
 * crypto.createHash('md5')//crypto模块的功能是加密并生成各种散列，此处所示为MD5方式加密
 * update(x).digest('hex')为加密后的密码
 */
Schema.methods.comparePassword = function(candidatePassword) {
	return crypto.createHash('md5').update(candidatePassword).digest('hex') === this.password
}

Schema.methods.incLoginAttempts = function() {
    // if we have a previous lock that has expired, restart at 1
	if (this.lockUntil && this.lockUntil < Date.now()) {//锁过期
		//$符号，mongodb中用来增删数据库的操作符
		//如果锁过期了就重置loginAttempts 并清除lockUnitl，所以账号非锁定状态下在数据库中不会有lockUnitl字段
        return this.updateAsync({
            $set: { loginAttempts: 1 },//$set用来指定一个键并更新键值，若键值不存在就创建
            $unset: { lockUntil: 1 }//$unset用来删除键值
        })
    }
    // otherwise we're incrementing
    const updates = { $inc: { loginAttempts: 1 } }//登录次数+1,在上锁状态和密码登录错误状态下都会执行，因为这两种情况都会调用incLoginAttempts
    // lock the account if we've reached max attempts and it's not locked already
    if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked) {//没上锁的情况下，登录徐下次登录次数超过最大值时执行上锁
        updates.$set = { lockUntil: Date.now() + LOCK_TIME }
    }
    return this.updateAsync(updates)
}

//做用户登录认证
Schema.statics.getAuthenticated = function(username, password) {
    return this.findOneAsync({username: username})
    .then(doc => {
    	// make sure the user exists
    	if (!doc) {
    		return reasons.NOT_FOUND
    	}
    	// check if the account is currently locked
    	if (doc.isLocked) {//doc->Schema.virtual('isLocked') doc就是schema,用法详见Mongoose.md -> virtual(是document的属性)
			//账户登录已经上锁的情况下，再次登录后增加登录次数记录
			return doc.incLoginAttempts().then(() => reasons.MAX_ATTEMPTS)//操作完成后返回最大登录次数
    	}
    	// test for a matching password
    	if (doc.comparePassword(password)) {//验证密码是否正确
    		// if there's no lock or failed attempts, just return the doc
    		if (!doc.loginAttempts && !doc.lockUntil) return doc//验证通过直接返回doc
			// reset attempts and lock info
			//密码验证通过的情况下，如果loginAttempts和lockAttmpts有一个不为false就都进行重置
    		const updates = {
                $set: { loginAttempts: 0 },
                $unset: { lockUntil: 1 }
            }
            return doc.updateAsync(updates).then(() => doc)
    	}
    	// password is incorrect, so increment login attempts before responding，密码错误
    	return doc.incLoginAttempts().then(() => reasons.PASSWORD_INCORRECT)
    })
}
/**
 *  使用Schema定义，需要将Schema转换为能够工作的Model。为此，我们把它传给
 *  'user'即为库表collection的名称
 */
export default mongoose.model('user', Schema)