import Model from '../models/user'

class Common{
	constructor(model) {
		Object.assign(this, {
			model, 
		})
	}

	/**
	 * 新建一个用户
	 * @param  {Object} body 
	 * @return {Function}          
	 */
	newAndSave(body) {
		return new this.model(body).save()//传入body，使用model模板来创建一个新的用户
	}

	/**
	 * 根据用户名查询一个用户
	 * @param  {String}   username 
	 * @return {Function}            
	 */
	findByName(username) {
		return this.model.findOneAsync({
			username: username
		})
	}
}

export default new Common(Model)