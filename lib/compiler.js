
const fs = require("fs");
const path = require("path");
// 整个文件只有一个默认导出
const traverse = require("@babel/traverse").default;
// 整个文件的导出都放在一个exports对象中
const parser = require("@babel/parser");
const { SyncHook } = require("tapable");
const babel = require('@babel/core');
class Compiler {
  constructor(config) {
    this.config = config;
    this.entry = config.entry;
    // this.root = process.cwd();
    this.analyseObj = [];
    // this.rules = config.module.rules || [];

    this.hooks = {
      // 生命周期的定义
      compile: new SyncHook(),
      afterCompile: new SyncHook(),
      emit: new SyncHook(),
      afterEmit: new SyncHook(),
      done: new SyncHook(),
      test:new SyncHook(['compilation','args'])
    };
    // plugins数组中所有插件对象,调用apply方法，相当于注册事件
    // if (Array.isArray(this.config.plugins)) {
    //   this.config.plugins.forEach((plugin) => {
    //     plugin.apply(this);
    //   });
    // }
  }
  
  start() {
    // 开始编译了
    this.hooks.compile.call();
    // 分析依赖 生成图谱
    const graph = this.getAtlas(this.entry);

    // 编译完成了
    this.hooks.afterCompile.call();
    // 开始发射文件了
    this.hooks.emit.call();
    this.emitFile(graph);
    this.hooks.afterEmit.call();
    this.hooks.done.call();
  }
  emitFile(graph) {
    let result = this.toEmitCode(this.entry, graph);
    let outputPath = path.join(
      this.config.output.path,
      this.config.output.filename
    );
    fs.writeFileSync(outputPath, result);
    // console.log(result)
  }
  getOriginPath(path1, path2) {
    return path.resolve(path1, path2);
  }
  // 核心函数
  depAnalyse(filename) {
    // 读取模块的内容
    let content = fs.readFileSync(filename, "utf-8");
    // 用于存取当前模块的所有依赖。便于后面遍历
    let dependencies = {};
    // 对文件内容进行解析并生成初始的抽象语法树
    const ast = parser.parse(content, {
      sourceType: "module", //babel官方规定必须加这个参数，不然无法识别ES Module
    });
    // 遍历ast 通过import找到依赖，存储依赖
    traverse(ast, {
      ImportDeclaration({ node }) {
        // 去掉文件名 返回目录
        const dirname = path.dirname(filename);
        const newFile = path.join(dirname, node.source.value);
        //保存所依赖的模块
        dependencies[node.source.value] = newFile;
      },
    });
    // transformFromAst 相当于是traverse和generate的结合
    const { code } = babel.transformFromAst(ast, null, {
      presets: ["@babel/preset-env"],
    });
    // generate 将ast转换为代码
    // 把当前的依赖，和文件内容推到对象里面去
    return {
      filename,
      dependencies, //该文件所依赖的模块集合(键值对存储)
      code, //转换后的代码
    };
  }
  readFile(modulePath) {
    return fs.readFileSync(modulePath, "utf-8");
  }
  getAtlas(entry) {
    const entryModule = this.depAnalyse(entry);
    this.analyseObj = [entryModule];
    for (let i = 0; i < this.analyseObj.length; i++) {
      const item = this.analyseObj[i];
      const { dependencies } = item; //拿到文件所依赖的模块集合(键值对存储)
      for (let j in dependencies) {
        this.analyseObj.push(this.depAnalyse(dependencies[j])); //敲黑板！关键代码，目的是将入口模块及其所有相关的模块放入数组
      }
    }
    //接下来生成图谱
    const graph = {};
    this.analyseObj.forEach((item) => {
      graph[item.filename] = {
        dependencies: item.dependencies,
        code: item.code,
      };
    });
    return graph;
  }
  toEmitCode(entry, graph) {
    //要先把对象转换为字符串，不然在下面的模板字符串中会默认调取对象的toString方法，参数变成[Object object],显然不行
    graph = JSON.stringify(graph);
    
    return `
        (function(graph) {
            //require函数的本质是执行一个模块的代码，然后将相应变量挂载到exports对象上
            function require(module) {
                //localRequire的本质是拿到依赖包的exports变量
                function localRequire(relativePath) {
                    return require(graph[module].dependencies[relativePath]);
                }
                var exports = {};
                (function(require, exports, code) {
                    eval(code);
                })(localRequire, exports, graph[module].code);
                return exports;//函数返回指向局部变量，形成闭包，exports变量在函数执行后不会被摧毁
            }
            return require('${entry}')
        })(${graph})`;
  }
  
}

module.exports = Compiler;

// (function (modules) {


//   function __webpack_require__(moduleId) {
//     var module = {
//       i: moduleId,
//       l: false,
//       exports: {}
//     };
//     // 执行函数并入参后三个
//     modules[moduleId].call(module.exports, module, __webpack_require__);
//     return module.exports;
//   }

//   return __webpack_require__(0);
// })([
//   (function (module, __webpack_exports__, __webpack_require__) {

//     // 引用 模块 1
//     "use strict";
//     Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
//     /* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__c__ = __webpack_require__(1);

// /* harmony default export */ __webpack_exports__["default"] = ('a.js');
//     console.log(__WEBPACK_IMPORTED_MODULE_0__c__["a" /* default */]);

//   }),
//   (function (module, __webpack_exports__, __webpack_require__) {

//     // 输出本模块的数据
//     "use strict";
//     /* harmony default export */ __webpack_exports__["a"] = (333);
//   })
// ]);