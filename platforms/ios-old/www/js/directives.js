var horizontalID = 1201;
var verticalID = 1202;
var basePixelID = 1203
var offset = 19;

angular.module('microbit.directives', ['microbit.services', 'ngCordova.plugins.deviceMotion'])



.directive('microbitBoard',function($interval, Bluetooth, $timeout, $q, $rootScope, $cordovaDeviceMotion) {
  return {

    // This means the directive can be used as an attribute only. Example <div microbit-board="variable"> </div>
    restrict: "A",
    scope: {
      board: '=board'
    },



    link: function(scope, element, attrs) {

      var maxy = 0;
      var maxx = 0;

      scope.rowValues = [0x00,0x00,0x00,0x00,0x00];

      scope.ui = [];
      var images = [];
      var loaders = [];

      scope.render = function(){
        _.each(scope.ui,function(uiElement){
          scope.ctx.drawImage(uiElement.image,uiElement.x,uiElement.y,uiElement.width,uiElement.height);
        });
      };
      
      scope.normalize = function(value){
        return (value-(-9))/(9-(-9))*65535;
      };

      document.addEventListener("deviceready", function () {
        console.log("here");



        scope.toggle = true;
        scope.rowCounter = 0;


        scope.accelerometer = $cordovaDeviceMotion.watchAcceleration({frequency:200});
        scope.accelerometer.then(
          null,
          function(error) {
          // An error occurred
          },
          function(result) {
            var y = result.y;
            var z = result.z;
            
            y=-y;

            if(y>6)
              y=6;
            if(y<-6)
              y=-6;

            if(z>4)
              z=2;
            else if(z<-4)
              z=-2;
            else
              z=0;


            y = Math.round(y+offset);
            z = Math.round(z+offset);





            //console.log(scope.board.controlling,Bluetooth.getConnected());
            if(scope.board.controlling && Bluetooth.getConnected()){
              

              if(scope.toggle){
                console.log("writing y: ",y);
                Bluetooth.write(function(object){
                  console.log(JSON.stringify(object));
                },function(object){
                  console.log(JSON.stringify(object));
                },horizontalID,y);

              }else{
                console.log("writing z: ",z);
                Bluetooth.write(function(object){
                  console.log(JSON.stringify(object));
                },function(object){
                  console.log(JSON.stringify(object));
                },verticalID,z);
              }

              scope.toggle=!scope.toggle;
            }
        });
      },false);

      scope.createSprite = function(x,y,width,height,image,name,events,toggle,downHandler,upHandler,clickHandler){
        scope.ui.push(
        {
          events:events,
          name:name,
          x:x,
          y:y,
          width:width,
          height:height,
          image:image,
          pressed:false,
          toggle:toggle,
          downHandler:downHandler,
          upHandler:upHandler,
          clickHandler:clickHandler
        });
      };

      scope.canvasMouseDown = function(evt){
        var offset = $(scope.element).offset();
        console.log(offset);
        var x = event.pageX - offset.left , y = event.pageY - offset.top;

        console.log("BEFORE x ", x, "BEFORE y ",y);
        var savedX = x;

        x = y;
        y = maxy - savedX;

        console.log("AFTER x ", x, "AFTER y ",y);

        _.each(scope.ui,function(uiElement){
          console.log(Math.sqrt((x-uiElement.x)*(x-uiElement.x) + (y-uiElement.y)*(y-uiElement.y)),Math.sqrt((x-uiElement.x)*(x-uiElement.x) + (y-uiElement.y)*(y-uiElement.y))<uiElement.width+20);

          if(Math.sqrt((x-uiElement.x)*(x-uiElement.x) + (y-uiElement.y)*(y-uiElement.y)) < (2*uiElement.width) && uiElement.events){
            uiElement.clickHandler(uiElement);
            uiElement.downHandler(uiElement);
          }
        });
      };

      scope.canvasMouseUp = function(evt){

        var offset = $(scope.element).offset();
        console.log(offset);
        var x = event.pageX - offset.left , y = event.pageY - offset.top;

        var savedX = x;

        x = y;
        y = maxy - savedX;

        _.each(scope.ui,function(uiElement){
          console.log(Math.sqrt((x-uiElement.x)*(x-uiElement.x) + (y-uiElement.y)*(y-uiElement.y)),Math.sqrt((x-uiElement.x)*(x-uiElement.x) + (y-uiElement.y)*(y-uiElement.y))<uiElement.width+20);

          if(Math.sqrt((x-uiElement.x)*(x-uiElement.x) + (y-uiElement.y)*(y-uiElement.y)) < (2*uiElement.width) && uiElement.events)
            uiElement.upHandler(uiElement);
        });
      };

      scope.onButtonDown = function(uiElement){
        console.log("DOWN");
        uiElement.pressed = true;
        uiElement.image = _.where(images,{src:"img/button-down.png"})[0].image;
      };

      scope.onButtonUp = function(uiElement){
        console.log("UP");
        uiElement.pressed = false;
        uiElement.image = _.where(images,{src:"img/button-up.png"})[0].image;
      };

      scope.writePixelData = function(row){

        console.log("writing pixel data ",scope.rowValues[row], " with id ",basePixelID+row);
        Bluetooth.write(function(object){
          console.log(JSON.stringify(object));
        },function(object){
          console.log(JSON.stringify(object));
        },basePixelID+row,scope.rowValues[row]);
      };

      scope.updateRow = function(coords){

        var shift = (1 << coords.col);

        if((scope.rowValues[coords.row] & shift))
          scope.rowValues[coords.row] = (scope.rowValues[coords.row] & ~shift);
        else
          scope.rowValues[coords.row]  |= shift;

        scope.writePixelData(coords.row);
      };

      scope.togglePixel = function(uiElement){

        uiElement.pressed = !uiElement.pressed;

        if(uiElement.pressed)
          uiElement.image = _.where(images,{src:"img/pixel-on.png"})[0].image;
        else
          uiElement.image = _.where(images,{src:"img/pixel-off.png"})[0].image;
        
        scope.updateRow(uiElement.name); //coords use name for now... 
      };

      scope.loadImage = function(src,width,height){
        var deferred = $q.defer();
        var sprite = new Image();
        sprite.onload = function() {
          images.push({src:src,image:sprite});
          deferred.resolve();
          scope.$apply();

        };

        sprite.onerror = function(err){
          deferred.resolve();
        };

        sprite.src = src;
        return deferred.promise;
      };

      console.log(element[0].clientWidth,element[0].clientHeight, element);


      var boardWidth = element[0].clientWidth;
      var boardHeight = 0; //element[0].clientHeight;

      if(boardWidth>612)
        boardWidth = 612;

      ratio = boardWidth/612;

      boardHeight = Math.round(498 * ratio);

      maxy = boardHeight;
      maxx = boardWidth;

      //loaders required because you can't synchonously load... there is no guarantee of ordering either... EW
      loaders.push(scope.loadImage("img/board.png",612,498));
      loaders.push(scope.loadImage("img/button-up.png",37,39));
      loaders.push(scope.loadImage("img/button-down.png",37,39));
      loaders.push(scope.loadImage("img/pixel-off.png",13,23));
      loaders.push(scope.loadImage("img/pixel-on.png",13,23));

      console.log("WIDTH: ",boardWidth," height:",boardHeight);

      console.log("loaders",loaders);
      $q.all(loaders).then(function(){
        //(scope.board.width || "612px") scope.board.height || "498px")
        scope.element = angular.element('<canvas data-tap-disabled="true" width="'+boardWidth+'px" height="'+boardHeight+'px"></canvas>');

        scope.canvas = scope.element[0];

        scope.ctx = scope.canvas.getContext("2d");

        scope.element.on("mousedown",scope.canvasMouseDown);
        scope.element.on("mouseup",scope.canvasMouseUp);
        //scope.element.on("touchstart",scope.canvasMouseDown);
        //scope.element.on("touchend",scope.canvasMouseUp);

        console.log("BUTTONA ",47*ratio,230*ratio);

        //urgh i hate javascript for it asynchonicity sometimes...
        scope.createSprite(0,0,boardWidth,boardHeight,_.where(images,{src:"img/board.png"})[0].image, "board", false);
        scope.createSprite(47*ratio,230*ratio,37*ratio,39*ratio,_.where(images,{src:"img/button-up.png"})[0].image,"buttonA",true,false,scope.onButtonDown,scope.onButtonUp, function(){});
        scope.createSprite(527.5*ratio,230*ratio,37*ratio,39*ratio,_.where(images,{src:"img/button-up.png"})[0].image,"buttonB",true,false,scope.onButtonDown,scope.onButtonUp, function(){});

        //row1
        scope.createSprite(205*ratio,155*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:4,row:0},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(251*ratio,155*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:3,row:0},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(300*ratio,155*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:2,row:0},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(347*ratio,155*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:1,row:0},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(394*ratio,155*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:0,row:0},true,true,function(){},function(){},scope.togglePixel);

        //row2
        scope.createSprite(205*ratio,201*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:4,row:1},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(251*ratio,201*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:3,row:1},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(300*ratio,201*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:2,row:1},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(347*ratio,201*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:1,row:1},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(394*ratio,201*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:0,row:1},true,true,function(){},function(){},scope.togglePixel);

        //row3
        scope.createSprite(205*ratio,247*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:4,row:2},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(251*ratio,247*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:3,row:2},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(300*ratio,247*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:2,row:2},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(347*ratio,247*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:1,row:2},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(394*ratio,247*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:0,row:2},true,true,function(){},function(){},scope.togglePixel);

        //row4
        scope.createSprite(205*ratio,295*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:4,row:3},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(251*ratio,295*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:3,row:3},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(300*ratio,295*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:2,row:3},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(347*ratio,295*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:1,row:3},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(394*ratio,295*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:0,row:3},true,true,function(){},function(){},scope.togglePixel);

        //row5
        scope.createSprite(205*ratio,342*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:4,row:4},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(251*ratio,342*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:3,row:4},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(300*ratio,342*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:2,row:4},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(347*ratio,342*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:1,row:4},true,true,function(){},function(){},scope.togglePixel);
        scope.createSprite(394*ratio,342*ratio,13*ratio,23*ratio,_.where(images,{src:"img/pixel-off.png"})[0].image,{col:0,row:4},true,true,function(){},function(){},scope.togglePixel);



        scope.timeoutID = $interval(function() {
          scope.render();
        }, 40);

        element.append(scope.element);
      });
      

      element.on('$destroy', function() {
        $interval.cancel(scope.timeoutID);
        $cordovaDeviceMotion.clearWatch(scope.accelerometer);
      });

      

      return;
    }
  };
});