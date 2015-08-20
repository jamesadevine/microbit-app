angular.module('microbit.controllers', ['microbit.services'])

.controller('AppCtrl', function($scope, $ionicModal, $ionicPopup, $ionicLoading, $timeout, Bluetooth) {
  $scope.devices = [];
  $scope.isScanning = false;

  $ionicModal.fromTemplateUrl('templates/scanner.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function(modal) {
    $scope.modal = modal;
  });

  $scope.scanForDevices = function(){

    if($scope.isScanning){
      $scope.stopScan();
      return;
    }

    $scope.isScanning = true;

    Bluetooth.scan(function(result){
      if(result.status == "scanResult" && _.find($scope.devices,function(device){ return device.address==result.address; }) === undefined){
        result.name = (result.name)?result.name:"<NO_ NAME>";
        $scope.devices.push(result);
      }
    },function(err){
      alert(JSON.stringify(err));
    });
  };

  $scope.stopScan = function(){
    $scope.isScanning = false;
    Bluetooth.stopScan(function(obj){
    },function(err){
    });
  };

  $scope.connect = function(object){
    $scope.isScanning = false;
    $scope.stopScan();

    $ionicLoading.show({
      content: 'Loading',
      animation: 'fade-in',
      showBackdrop: true,
      maxWidth: 200,
      showDelay: 0
    });

    Bluetooth.connect(function(object){
      if(object.status == "connected"){
        

        Bluetooth.setConnected(object);

        Bluetooth.getServices(function(services){
    
          var uuid = _.find(services.serviceUuids,function(uuid){ return uuid == Bluetooth.getUuids().serviceUuid; });

          if(!uuid){
            $ionicLoading.hide();
            $ionicPopup.alert({
              title: 'Couldn\'t get characteristics',
              template: 'Is this a micro:bit?'
            });

            return;
          }

          Bluetooth.getCharacteristics(function(characteristics){
            $ionicLoading.hide();
            $scope.closeScanner();
            $ionicPopup.alert({
              title: 'Connected',
              template: 'Successfully connected! :)'
            });
          },function(characteristics){
            $ionicLoading.hide();
            $ionicPopup.alert({
              title: 'Couldn\'t get characteristics',
              template: 'Failed to get info '+JSON.stringify(characteristics)
            });
          },Bluetooth.getConnected().address,uuid);

        },function(services){
          $ionicLoading.hide();
          $ionicPopup.alert({
            title: 'Couldn\'t get services',
            template: 'Failed to get info '+JSON.stringify(services)
          });
        },Bluetooth.getConnected().address);

      }else if(object.status == "disconnected"){
        Bluetooth.disconnect(object);
      }
      
    },function(){
      $ionicLoading.hide();
      $ionicPopup.alert({
        title: 'Couldn\'t connect',
        template: 'Failed to connect to your micro:bit! :('
      });
    },object.address);
  };

  $scope.characteristics = function(device){
    $ionicLoading.show({
      content: 'Loading',
      animation: 'fade-in',
      showBackdrop: true,
      maxWidth: 200,
      showDelay: 0
    });

    Bluetooth.getServices(function(services){
    
      var uuid = _.find(services.serviceUuids,function(uuid){ return uuid == Bluetooth.getUuids().serviceUuid; });

      if(!uuid){
        $ionicLoading.hide();
        $ionicPopup.alert({
          title: 'Couldn\'t get characteristics',
          template: 'Is this a micro:bit?'
        });

        return;
      }

      Bluetooth.getCharacteristics(function(characteristics){
        $ionicLoading.hide();
        $ionicPopup.alert({
          title: 'Characterstics',
          template: JSON.stringify(characteristics)
        });
      },function(characteristics){
        $ionicLoading.hide();
        $ionicPopup.alert({
          title: 'Couldn\'t get characteristics',
          template: 'Failed to get info '+JSON.stringify(characteristics)
        });
      },Bluetooth.getConnected().address,uuid);

    },function(services){
      $ionicLoading.hide();
      $ionicPopup.alert({
        title: 'Couldn\'t get services',
        template: 'Failed to get info '+JSON.stringify(services)
      });
    },Bluetooth.getConnected().address);

    /*
    Bluetooth.getCharacteristics(function(object){
      $ionicLoading.hide();
      $ionicPopup.alert({
        title: 'Characterstics',
        template: JSON.stringify(object)
      });
    },function(object){
      $ionicLoading.hide();
      $ionicPopup.alert({
        title: 'Couldn\'t get characteristics',
        template: 'Failed to get info '+JSON.stringify(object)
      });
    },device.address);*/
  };

  $scope.showScanner = function(){
    $scope.modal.show();
  };

  $scope.closeScanner = function(){
    if($scope.isScanning)
      $scope.stopScan();
    $scope.modal.hide();
  };

})

.controller('HomeCtrl', function($scope, $ionicModal, $timeout, Bluetooth, $ionicPopup) {

  $scope.accelIndex = 0;

  
  $scope.colors = ["black","green","amber","red"];
  $scope.accels = [2,4,6,9];

  $scope.color = $scope.colors[$scope.accelIndex];

  $scope.properties = {
    name:"microbit",
    controlling:false,
    maxAccel:$scope.accels[$scope.accelIndex],
    minAccel:-$scope.accels[$scope.accelIndex],
    acceleration: 0
  };

  $scope.$watch('properties.acceleration', function() {
       console.log($scope.properties.acceleration);
   });

  $scope.swapSpeed = function(acceleration){

    $scope.accelIndex++;

    if($scope.accelIndex > $scope.accels.length-1)
      $scope.accelIndex = 0;

    $scope.properties.maxAccel = $scope.accels[$scope.accelIndex];
    $scope.properties.minAccel = -$scope.accels[$scope.accelIndex];
    $scope.color = $scope.colors[$scope.accelIndex];
  };

  $scope.control = function(){
    if(!Bluetooth.getConnected()){
      $ionicPopup.alert({
        title: 'No device connected',
        template: 'Woah! You need to connect to your micro:bit first!'
      });
      return;
    }

    $scope.properties.controlling = !$scope.properties.controlling;

    if(!$scope.properties.controlling){
      Bluetooth.write(function(object){
        console.log(JSON.stringify(object));
      },function(object){
        console.log(JSON.stringify(object));
      },1201,19);

      Bluetooth.write(function(object){
        console.log(JSON.stringify(object));
      },function(object){
        console.log(JSON.stringify(object));
      },1202,19);
    }
  };

  $scope.counter = 0;

  $scope.write = function(){
      if($scope.counter > 0){
        Bluetooth.write(function(object){
          console.log(JSON.stringify(object));
        },function(object){
          console.log(JSON.stringify(object));
        },1203+($scope.counter-1),0x00);
      }else if($scope.counter === 0){
        Bluetooth.write(function(object){
          console.log(JSON.stringify(object));
        },function(object){
          console.log(JSON.stringify(object));
        },1203+4,0x00);
      }
      Bluetooth.write(function(object){
        console.log(JSON.stringify(object));
      },function(object){
        console.log(JSON.stringify(object));
      },1203+$scope.counter,0x1F);

      $scope.counter++;

      if($scope.counter>4){
        $scope.counter = 0;
      }
  };


});