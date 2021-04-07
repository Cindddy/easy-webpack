
const path = require('path') 

//  1. 读取需要打包项目的配置文件
let config = require(path.resolve('webpack.config.js'))
// 核心 编译器
const Compiler = require('../lib/compiler')
let myCompiler = new Compiler(config)
myCompiler.start()
