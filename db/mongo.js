import bluebird from 'bluebird'
import mongoose from 'mongoose'
import mongoomise from 'mongoomise'
/**
 * mongodb连接
 */
class Mongo{
	constructor(app, config) {
		Object.assign(this, {
			app, 
			config, 
		})

		this.init()
	}

	init() {
		this.env    = this.app.get('env')//获取全局环境，在package.json中指定NODE_ENV=production
		this.dblink = this.config['mongo'][this.env]['connectionString']//根据config连接数据库

		const opts = {
			useMongoClient: true,
			server: {
				socketOptions: { 
					keepAlive: 1 
				}
			}
		}

		mongoose
			.connect(this.dblink, opts)
			.connection
			.on('error', err => console.log('------ Mongodb connection failed ------' + err))
			.on('open', () => console.log('------ Mongodb connection succeed ------'))

		mongoose.Promise = global.Promise
			
		mongoomise.promisifyAll(mongoose, bluebird)
	}
}

export default Mongo