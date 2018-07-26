import paginate from '../common/paginate'
import tools from '../common/tools'
import jwt from '../common/jwtauth'

export default function(req, res, next) {
	//res.paginate的右边是一个函数，函数赋值个res.paginate,该函数传入可变参数，供后续调用，不是直接执行
	res.paginate = (...args) => new paginate(...args).init()
	res.tools = new tools(req, res)
	res.jwt   = jwt
	next()
}