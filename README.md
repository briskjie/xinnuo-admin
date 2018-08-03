"# xinnuo-admin" 

public里面的文件修改了需要重新build  -> npm run build,不需要停服

config.js中替换成自己的appid和secret


window启动mongodb    mongod --dbpath D:\data\db开启了服务端，另开一个终端后，作为客户端： mongo 连接数据库
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


vs-code 调试   es6+babel+nodejs:在package.json里面添加debug,使用babel-node,使其支持import,而不是node:
"scripts": {
    ...
    ...
    "debug": "babel-node --inspect=9229 ./bin/www"
  },


 vscode中 alt+F12：快速打开终端
 开启debug:f5




 采用AngularUI路由器模块等应用程序接口可以分为不同个$state（状态）。Angular的核心为路由服务，URLs可以用来控制视图。AngularUI路由提供了一个更强大的状态管理，即状态可以被命名，嵌套，以及合并视图，允许一个以上的模板呈现在同一页面，此外，每个状态无需绑定到一个URL，并且数据可以更灵活地推送到每个状态