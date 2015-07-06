var horizontalID = 1201;
var verticalID = 1202;
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
        scope.previous = 13;

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



            console.log(scope.board.controlling,Bluetooth.getConnected());
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

      scope.createSprite = function(x,y,width,height,image,name,events,downHandler,upHandler){
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
          downHandler:downHandler,
          upHandler:upHandler
        });
      };

      scope.canvasMouseDown = function(evt){
        var offset = $(scope.element).offset();
        console.log(offset);
        var x = event.pageX - offset.left, y = event.pageY - offset.top;

        _.each(scope.ui,function(uiElement){
          console.log(Math.sqrt((x-uiElement.x)*(x-uiElement.x) + (y-uiElement.y)*(y-uiElement.y)),Math.sqrt((x-uiElement.x)*(x-uiElement.x) + (y-uiElement.y)*(y-uiElement.y))<uiElement.width+20);

          if(Math.sqrt((x-uiElement.x)*(x-uiElement.x) + (y-uiElement.y)*(y-uiElement.y)) < (2*uiElement.width) && uiElement.events)
            uiElement.downHandler(uiElement);
        });
      };

      scope.canvasMouseUp = function(evt){
        _.each(scope.ui,function(uiElement){
          if(uiElement.events)
            uiElement.upHandler(uiElement);
        });
      };

      scope.onButtonDown = function(uiElement){
        uiElement.image = _.where(images,{src:"img/button-down.png"})[0].image;
      };

      scope.onButtonUp = function(uiElement){
        uiElement.image = _.where(images,{src:"img/button-up.png"})[0].image;
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

      //loaders required because you can't synchonously load... there is no guarantee of ordering either... EW
      loaders.push(scope.loadImage("img/board.png",boardWidth,boardHeight));
      loaders.push(scope.loadImage("img/button-up.png",37,39));
      loaders.push(scope.loadImage("img/button-down.png",37,39));

      console.log("WIDTH: ",boardWidth," height:",boardHeight);

      console.log("loaders",loaders);
      $q.all(loaders).then(function(){
        //(scope.board.width || "612px") scope.board.height || "498px")
        scope.element = angular.element('<canvas data-tap-disabled="true" style="border: solid 5px red;" width="'+boardWidth+'px" height="'+boardHeight+'px"></canvas>');

        scope.canvas = scope.element[0];

        scope.ctx = scope.canvas.getContext("2d");

        scope.element.on("mousedown",scope.canvasMouseDown);
        scope.element.on("mouseup",scope.canvasMouseUp);
        scope.element.on("touchstart",scope.canvasMouseDown);
        scope.element.on("touchend",scope.canvasMouseUp);

        //urgh i hate javascript for it asynchonicity sometimes...
        scope.createSprite(0,0,boardWidth,boardHeight,_.where(images,{src:"img/board.png"})[0].image, "board", false);
        scope.createSprite(47,230,37,39,_.where(images,{src:"img/button-up.png"})[0].image,"buttonA",true,scope.onButtonDown,scope.onButtonUp);
        scope.createSprite(527.5,230,37,39,_.where(images,{src:"img/button-up.png"})[0].image,"buttonB",true,scope.onButtonDown,scope.onButtonUp);

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