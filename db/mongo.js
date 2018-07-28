import bluebird from 'bluebird'
import mongoose from 'mongoose'
import mongoomise from 'mongoomise'
/**
 * mongodb连接
 * http://mongoosejs.com/docs/connections.html官方文档
 * 
 * bluebird http://bluebirdjs.com/docs/why-promises.html
 *  
 */
class Mongo {
	constructor(app, config) {
		Object.assign(this, {
			app,
			config,
		})

		this.init()
	}

	init() {
		this.env = this.app.get('env')//获取全局环境，在package.json中指定NODE_ENV=production
		this.dblink = this.config['mongo'][this.env]['connectionString']//根据config连接数据库
		//指定通过mongoose连接数据库时的配置，官方文档中有对Options进行说明
		/**
		 * The connect method also accept options object which will be passed on to the underlying MongoDB driver
		 * mongoose5.x需要指定使用useMongoClient来连接mongodb，不然会出现warning
		 */
		const opts = {
			useMongoClient: true,
			server: {
				socketOptions: {
					keepAlive: 1 //连接保活，默认为true
				}
			}
		}

		mongoose
			.connect(this.dblink, opts)
			.connection
			.on('error', err => console.log('------ Mongodb connection failed ------' + err))
			.on('open', () => console.log('------ Mongodb connection succeed ------'))

		mongoose.Promise = global.Promise//使用Promise链式结构代替回调嵌套监听的方式来改进代码，类似rxjava
		//bluebird就是一个高性能的Promise，并且加上了特别好的util api
		mongoomise.promisifyAll(mongoose, bluebird)//对于bluebird查阅文档，简而言之就是一个promise库
	}
}

export default Mongo