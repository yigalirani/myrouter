/* jshint node: true */
'use strict';
const http = require('http');
const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const url= require('url');
module.exports = Router;

let mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.eot': 'appliaction/vnd.ms-fontobject',
  '.ttf': 'aplication/font-sfnt'
};
function send_file(file, res) {
    fs.readFile(file.slice(1), (err, data) => {
  		if (err){
			res.statusCode = 404;
    		res.end('file not found, yo:'+file);
    		return;
  		}
        var ext = path.extname(file);
        var type = mimeTypes[ext];
        res.setHeader('Content-Type',type );	
  		res.end(data,'binary');

	});
}
function Params(){
    this.req=null;
    this.res=null;
    this.cb=null;
    this.routes=null;
    this.href=function(overrides,copy){
        var ans='?';
        function append(name,obj){
            var val=obj[name];
            if (val === undefined)
                return;
            ans+=name+'='+encodeURIComponent(val)+'&';
        }
        if ('action' in overrides)
            append('action',overrides);
        else
            append('action',this);
        for (let name in overrides)
            if (name!='action')
                append(name,overrides);
        for (let i in copy){
            let name=copy[i];
            if (!(name in overrides) && name in this && name!='action')
                append(name,this);
        }
        return ans.slice(0,-1);
    };
    this.a=function(text,overrides,copy){
        var _href=this.href(overrides,copy);
        return '<a href='+_href+'>'+text+'</a>';
    };
}
function explode(s,sep){
    if (!s)
        return [];
    return _.filter(s.split(sep));
}
function calc_config(user_config){
    var config={
        hostname:'localhost',
        port:80,
        static_files:null,
        controller:null,
        default_action:null
    };
    _.extend(config,user_config);
    return config;
}
function Rule(_action,_mandatory,_optional){//is there a util to create functions/classes like this automaticly?
    this.action=_action;
    this.mandatory=_mandatory;
    this.optional=_optional;
}
function calc_routes(rules){
    var ans={};
    _.forEach(rules,rule_string=>{
        let [mandatory, optional] = explode(rule_string,':');
        mandatory=explode(mandatory,'/');
        let action=mandatory[0];
        let  rule=new Rule(action,mandatory.slice(1),explode(optional,'/'));
        ans[rule.action]=rule;
    });
    return ans;
}
function Router(user_config){
    var routes={};
    var controller=null;

    function error_cb(message){
        return function(p){
            p.res.statusCode = 200;
            p.res.setHeader('Content-Type', 'text/html');
            p.res.end(message);
		};
    }
	function calc_params(req,config){
        function calc_cb(action){
            if (action===undefined)
                return error_cb("action undefined");
            
            if (controller===undefined)
                return error_cb("controller undefined");
            var cb=controller[action];
            if (cb===undefined)
                return error_cb("no cb for action "+action);
            return cb;
        }
        function add_path_params(){
        }
        var params=new Params();
        _.extend(params,url.parse(req.url,true).query);

        add_path_params();
        if (!params.action){
            params.action=config.default_action;
        }
        params.cb=calc_cb(params.action);
        return params;
    }

    var config=calc_config(user_config); //adds defaut values if none exists    
    controller=config.controller;
    if (config.static_files)
        var re = new RegExp(config.static_files); //othersize, re is undefined, thanks you, function-level vars
    routes=calc_routes(config.path_rules);
    const server = http.createServer((req, res) => {
        console.log(req.url);
        res.statusCode = 200; //default response values, overide if needed
        res.setHeader('Content-Type', 'text/html');
        if (re && re.test(req.url))
            return send_file(req.url,res);
        var params=calc_params(req,config);
        params.req=req;
        params.res=res;
        if (controller.all)
            controller.all(params);
        params.cb(params);
    });
    server.listen(config.port,config.hostname, () => {
          console.log(`Server running at http://${config.hostname}:${config.port}`);
    });
}
