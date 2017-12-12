(function() {

  'use strict';

  function TipoTypeController(
    tipoRouter,
    $window,
    $scope,
    $rootScope,
    tipoInstanceDataService,
    TipoTypeService,
    tipoManipulationService,
    $stateParams) {

    var _instance = this;
    var tipo_name = $stateParams.tipo_name;
    var tipo_types = $scope.tipoRootController.tipos || [];
    var application = $scope.tipoRootController.tipoDefinition.application;
    var tipo_groups = $scope.tipoRootController.root.tipo_field_groups;
    if (!_.isUndefined(tipo_groups)) {
      _.each(tipo_groups,function(tipo_group){
        tipo_types.push({ key: "FieldGroup." + tipo_group.tipo_group_name,
                          label: tipo_group.tipo_group_name,
                          icon: "group_work",
                          field_group: true});
      });
    };
    var perspectiveMetadata = tipoManipulationService.resolvePerspectiveMetadata();
    var filter = {};
    if (perspectiveMetadata.tipoName) {
      if (perspectiveMetadata.tipoName !== $scope.tipoRootController.tipoDefinition.tipo_meta.tipo_name) {
        filter.tipo_filter = perspectiveMetadata.tipoFilter;
      }
    }
    filter.page = 1;
    filter.per_page = 100;
    if (filter.tipo_filter && filter.tipo_filter !== "") {
      filter.tipo_filter = "(!_exists_:tipo_role AND application:$tipoContext.application)";
    }else{
      filter.tipo_filter = "(!_exists_:tipo_role AND application:$tipoContext.application)";
    }
    tipoInstanceDataService.search("TipoDefinition",filter).then(function(tipo_objects){
      _instance.tipo_objects = tipo_objects;
      _.each(tipo_objects,function(tipo_object){
    	  /**Either Tipos are from the same application or other application that the user has access to. 
    	   * But, don't allow others to refer to Tipo application objects. 
    	   * TODO: We may have to allow refering to TipoAccount & TipoUser, that can be allowed explicitly. */
      if ( application === tipo_object.application ||
    		  ! (tipo_object.application === "1000000001" 
    	  && tipo_object.application_owner_account === "2000000001"))
      tipo_types.push({ key: "Tipo." + tipo_object.tipo_id,
                        label: tipo_object.tipo_meta.display_name,
                        icon: tipo_object.tipo_meta.icon,
                        tipo_object: true});
      });
      if ($scope.tipoRootController.ngModel) {
      _.each(tipo_types, function(tipo){
          if(tipo.key === $scope.tipoRootController.ngModel){
            tipo.selected = true;
            $scope.tipoRootController.selectedTipos = [tipo];
          }
        });
      };
      _instance.tipo_types = tipo_types;
    });
    var tipos = angular.copy($scope.tipoRootController.tiposWithDefinition);

    _instance.tipos = tipos;
    

    _instance.toEdit = function(tipo_id){
      tipoRouter.toTipoEdit(tipo_name, tipo_id);
    };

    _instance.launch = function(tipo){
      $window.open(tipo.app_url, '_blank');
    };

    var listener = $scope.$watch(function(){return $scope.tipoRootController.tipos},function(new_value,old_value) {
      if(new_value) {
        tipo_types = _.union(tipo_types, new_value);
        listener();
      }
    },true);

  }

  function TipoTypeService(){
    var tipo_types = [{
      key: "integer",
      label: "Number",
      icon: "format_list_numbered",
    },{
      key: "string",
      label: "Text",
      icon: "sort_by_alpha",
    },{
      key: "longstring",
      label: "Multiline Text",
      icon: "view_array",
    },{
      key: "richstring",
      label: "Rich Text",
      icon: "format_shapes",
    },{
      key: "htmlLink",
      label: "Link",
      icon: "link",
    },{
      key: "boolean",
      label: "True/False",
      icon: "check_box",
    },{
      key: "password",
      label: "Password",
      icon: "enhanced_encryption",
    },{
      key: "date_time",
      label: "Date/Time",
      icon: "perm_contact_calendar",
    },{
      key: "colour",
      label: "Colour",
      icon: "color_lens",
    },{
      key: "file",
      label: "File",
      icon: "insert_drive_file",
    },{
      key: "divider",
      label: "Divider",
      icon: "remove",
    },{
      key: "empty",
      label: "Empty",
      icon: "remove_circle_outline",
    },{
      key: "simpleimage",
      label: "Simple Image",
      icon: "photo_size_select_actual",
    },{
      key: "location",
      label: "Location",
      icon: "location_on",
    },
    {
      key: "javascript",
      label: "Javascript",
      icon: "code",
    },
    //{
    //  key: "s3explorer",
    //  label: "S3 Browser",
    //  icon: "open_in_browser",
    //},
    //{
    //  key: "visualisation",
    //  label: "Visualisation",
    //  icon: "insert_chart",
    //},
    {
      key: "action",
      label: "Button",
      icon: "alarm_add",
    }];

    return{
      gettipo_types: function(){
        return tipo_types;
      },
    }
  }

  angular.module('tipo.tipoapp')
  .controller('TipoTypeController', TipoTypeController)
  .service('TipoTypeService', TipoTypeService);

})();