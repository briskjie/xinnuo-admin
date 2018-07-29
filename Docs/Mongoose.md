https://www.cnblogs.com/surahe/p/5178654.html
1、定义Schema
    在mongoose中，一切都是由schema开始的，每一个schema对应一个mongodb collection，并且在那个collection里面定义了documents的模型。
    如果想增加额外的键，使用Schema#add方法。
    var mongoose = require('mongoose');
    var Schema = mongoose.Schema;

    var blogSchema = new Schema({
            title:  String,
            author: String,
            body:   String,
            comments: [{ body: String, date: Date }],
            date: { type: Date, default: Date.now },
            hidden: Boolean,
            meta: {
                 votes: Number,
                favs:  Number
            }
});
在blogSchema中的每一个key定义了在document中的一个属性，将转换为它相关的Schema类型，例如，我们已经定义了title为String Schema类型
键也可以指定为嵌套对象包含更多的key/type定义，例如上述的meta属性
合法的Schema类型:
String Number Date Buffer Boolean Mixed ObjectId Array

Schema不仅定义了document的结构和构造了属性，还定义了document实例方法，静态Model方法，复合索引和被称作middleware的document生命周期钩子

2、创建一个Model
    使用Schema定义，需要将blogSchema转换为能够工作的Model。为此，我们把它传给
    mongoose.model('Blog',blogSchema); 'Blog'就是在数据库中查询到的collection的表名
3、Model的实例是document。document有很多内置的实例方法，我们也可以自定义自己的实例方法。

Schema Model Document关系

Schema相当于图纸，Model相当于模型，Document就是通过模型浇筑的实体，并且具有了一系列的功能，譬如增删改查