var express = require('express')
, jsdom = require('jsdom')
, request = require('request')
, url = require('url')
, http = require('http')
, constants = require("./constants")
, path = require('path');

var app = express();

var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'testuser99'
});

connection.connect();
connection.query('use scrapdb');


function handleDisconnect(connection) {
  connection.on('error', function(err) {
    if (!err.fatal) {
      return;
    }

    if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
      throw err;
    }

    console.log('Re-connecting lost connection: ' + err.stack);

    connection = mysql.createConnection(connection.config);
    handleDisconnect(connection);
    connection.connect();
  });
}

handleDisconnect(connection);



app.configure(function(){
    app.set('port', process.env.PORT || 3000);
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
    app.use(express.errorHandler());
});

app.get("/",function(req,res) {
    res.end("dobby not so smart");
    delete req;
});


function secondLevel(paramurl){
    connection.query('SELECT hrefurl from appdata where hrefurl="'+paramurl+'"', function(err, result) {
                                console.log(err);
                                for(val in result){
                                        var srcurl = result[val].hrefurl;
                                        var currenturi = 'https://play.google.com' + result[val].hrefurl;
                                        delete val;
                                         request({uri: currenturi}, function(err, response, body) {
                                            if (err && response.statusCode !== 200) {
                                                console.log('Request error.');
                                            }
                                            delete err;
                                            delete response;
                                            jsdom.env({
                                                html: body,
                                                scripts: ['./public/javascripts/jquery-1.6.min.js']
                                            }, function(err, window) {
                                                delete err;
                                                var $ = window.jQuery;
                                                devemail = $('.contact-developer-spacer').next('a').attr('href');
                                                if (devemail) {
                                                    devemail = devemail.substr(7);
                                                }
                                                console.log(devemail);
                                                var devwebsite = $('.doc-description-show-all').next('a').attr('href');
                                                handleDisconnect(connection);
                                                connection.query('UPDATE appdata set dev_email="' + devemail + '",website_url="' + devwebsite + '" where hrefurl="' +srcurl+ '"');
                                                window.close();

                                            });

                                        });
                                }
                        });
}
  
               


app.get('/android/:type/', function(req, res){
    var type = req.params['type'];
    var genre = req.query['genre'] || "all";
    
    if (constants.ANDROID_TYPES.indexOf(type) == -1) {
	res.end("Invalid type");
	return;
    }

    if (constants.ANDROID_GENRES.indexOf(genre) == -1) {
	res.end("Invalid genre");
	return;
    }
	res.writeHead(200, { 'Content-Type': 'application/json' });

var yz=0;
for(var xy=0; xy<=4800; xy=xy+24){
    yz=xy+24;
    var uri;
   
	uri = "https://play.google.com/store/apps/category/"+genre+"/collection/topselling_"+type+"?start="+xy+"&num="+yz;
        console.log("uri:"+uri);
    
    request({uri: uri}, function(err, response, body){
 
        if(err && response.statusCode !== 200){console.log('Request error.');}
	
	jsdom.env({
            html: body,
            scripts: [constants.APP_DOMAIN+'/javascripts/jquery-1.6.min.js']
        }, function(err, window){
            delete err;
	  //  res.writeHead(200, { 'Content-Type': 'application/json' });
            var $ = window.jQuery;
	    var result = {'apps':[]};
	    var parentElem = $('html');
	   
	    $('.snippet',parentElem).each(function() {
		elem$ = $(this);
		var average_rating = $('.ratings',elem$).attr("title");
		if (average_rating) {
		    average_rating = parseFloat(average_rating.split(" ")[1]);
		}
                var paramurl = $('a', elem$).first().attr("href");
		var app_data = {		    
		    'app_id':url.parse($('.title',elem$).first().attr("href"),true).query["id"],
		    'name':$('.title',elem$).first().attr("title"),
		    'hrefurl':$('a', elem$).first().attr("href"),
		    'image_url':$('.thumbnail img',elem$).first().attr("src"),
		    'publisher_url':"https://"+constants.GOOGLE_PLAY_DOMAIN+$('.attribution a',elem$).first().attr("href"),
		    'publisher_name':$('.attribution a',elem$).first().text(),
		    'publisher_id':url.parse($('.attribution a',elem$).first().attr("href"),true).query['id'],
		    'price': parseFloat($('.buy-button-price',elem$).text().split(" ")[0].replace("$","").replace("Install","0")),
		    "description":"",
		    "average_rating":average_rating,
		    "rating_count":'ignored it',
		    "release_date":"",
		    'rank':parseInt($('.ordinal-value',elem$).first().text())
		};
                
		result['apps'].push(app_data);
		connection.query('INSERT INTO appdata SET ?', app_data, function(err, result) {
                        delete err;
                        delete res;
                        secondLevel(paramurl);
		});

		
	    });

	   res.write(JSON.stringify(result));
           delete res;
           window.close();
	    
        });
    }); 
  }
});


http.createServer(app).listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
});

global.gc();