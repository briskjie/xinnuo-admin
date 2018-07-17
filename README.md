"# xinnuo-admin" 

config.js中替换成自己的appid和secret


window启动mongodb    mongod --dbpath D:\Users\cxx\MySpring\mongodb\data开启了服务端，另开一个终端后，作为客户端： mongo 连接数据库
window启动redis redis-server.exe  客户端:redis-cli

ubuntu启动Mongodb  sudo systemctl start mongod
ubuntu启动redis 随服务器自启动


项目重新部署

后端服务：

1. 安装 `Node.js[必须]` `MongoDB[必须]` `Redis[必须]`
2. 启动 MongoDB 和 Redis
3. 进入根目录下执行 `npm install` 安装项目所需依赖包
3. 执行 `npm start` 启动服务
4. 打开浏览器访问 `http://localhost:3000`



前端服务：

1. 首次启动项目未找到 build 文件
2. 进入 public 目录下执行 `npm install` 安装项目所需依赖包
3. 执行 `npm run build` 编译前端页面相关文件
4. 编译成功后生成 build 文件，位于 public 目录下
其他命令:


# 生成 API 接口文档
npm run apidoc
# 跑测试用例
npm test