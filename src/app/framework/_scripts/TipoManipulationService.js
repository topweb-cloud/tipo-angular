(function() {

  'use strict';

  function TipoManipulationService(tipoRegistry, $rootScope) {

    function setupMustacheOverrides(){
      Mustache.tags = ['[[', ']]'];
    }
    setupMustacheOverrides();

    function isSingleton(tipo){
      return _.findIndex(tipo.tipo_meta.tipo_type, function(each){
        return _.startsWith(each, 'singleton');
      }) !== -1;
    }

    function extractShortDisplayFields(definition){
      var eligibleFields = [];
      extractShortDisplayFieldsRecursive(definition, eligibleFields);
      return eligibleFields;
    }

    function extractShortDisplayFieldsRecursive(definition, collection){
      var eligibleFields = _.filter(definition.tipo_fields, function(each){
        return each.short_display && !each.hidden_;
      });
      _.each(eligibleFields, function(each){
        if(each._ui.isGroup){
          extractShortDisplayFieldsRecursive(each, collection);
        }else{
          collection.push(each);
        }
      });
    }

    function mergeDefinitionAndData(tipoDefinition, tipoData, resetExistingData, copy){
      if(tipoDefinition.tipo_fields){
        if (_.isUndefined(copy)) {
          copy = false;
        };
        _.each(tipoDefinition.tipo_fields, function(field){
          var fieldKey = field.field_name;
          var fieldType = field.field_type;
          var istransient = _.find(field.metadata,{key_ : 'transient'});
          if(istransient && copy){
            var fieldValue;
            delete tipoData[fieldKey];
          }else{
            var fieldValue = tipoData[fieldKey];
          };
          if(resetExistingData){
            delete field._value;
          }
          if(_.isUndefined(fieldValue)){
            return;
          }else{
            field._hadValueOriginally = true;
          }
          var isArray = Boolean(_.get(field, '_ui.isArray'));
          var isGroup = Boolean(_.get(field, '_ui.isGroup'));
          var isRelatedTipo = Boolean(_.get(field, '_ui.isTipoRelationship'));
          if(isRelatedTipo && !isGroup){
            var hasOnlyKey = _.isUndefined(field.label_field);
            if(hasOnlyKey){
              if(isArray){
                field._value = [];
                _.each(fieldValue, function(each){
                  field._value.push({
                    key: each,
                    label: each
                  });
                });
              }else{
                field._value = {
                  key: fieldValue,
                  label: fieldValue
                };
              }
            }else{
              if(isArray){
                field._value = [];
                if(!_.isEmpty(fieldValue)){
                  _.each(fieldValue, function(each){
                    field._value.push({
                      key: each,
                      label: _.get(tipoData, fieldKey + '_refs.ref' + each)
                    });
                  });
                }
              }else{
                field._value = {
                  key: fieldValue,
                  label: _.get(tipoData, fieldKey + '_refs.ref' + fieldValue)
                };
              }
            }
          }
          else if(isGroup){
            if(isArray){
              // special sorting by the sequence field
              var sequenceField = _.find(field.tipo_fields, function(each){
                return each.field_name === 'sequence';
              });
              if(!_.isUndefined(sequenceField)){
                fieldValue = _.sortBy(fieldValue, function(each){
                  if(each.sequence){
                    return parseFloat(each.sequence, 10);
                  }else{
                    return 999;
                  }
                });
                tipoData[fieldKey] = fieldValue;
              }
              _.each(fieldValue, function(item){
                var itemField = generateGroupItem(field);
                if(item._ARRAY_META){
                  itemField._ui.hash = item._ARRAY_META._HASH;
                }
                mergeDefinitionAndData(itemField, item ,resetExistingData, copy);
              });
            }else{
              mergeDefinitionAndData(field, fieldValue,resetExistingData, copy);
              // determine if the group has values for any field
              var hasValue = false;
              _.each(field.tipo_fields, function(each){
                if(!each.hidden_ && !_.isUndefined(each._value)){
                  hasValue = true;
                  return false;
                }
              });
              field._ui.hasValue = hasValue;
            }
          }else{
            if(isArray){
              field._value = [];
              _.each(fieldValue, function(each){
                field._value.push({
                  key: each,
                  label: each
                });
              });
            }else{
              var label = fieldValue;
              if(fieldType === 'boolean'){
                fieldValue = Boolean(fieldValue);
                label = fieldValue ? 'Yes' : 'No';
                fieldValue = fieldValue ? true : false;
              }else if (fieldType === 'date_time'){
                if(fieldValue){
                  fieldValue = new Date(fieldValue);
                }
              }
              field._value = {
                key: fieldValue,
                label: label
              };
            }
          }
        });
      }
    }

    function mergeDefinitionAndDataArray(tipoDefinition,tipoDataArray,label_field){
      var tiposWithDefinition = [];
      _.each(tipoDataArray, function(tipo){
        var clonedDefinition = _.cloneDeep(tipoDefinition);
        mergeDefinitionAndData(clonedDefinition, tipo);
        clonedDefinition.tipo_fields = extractShortDisplayFields(clonedDefinition);
        tiposWithDefinition.push({
          key: tipo.tipo_id,
          value: clonedDefinition,
          label : tipo[label_field],
          perm: tipo.perm
        });
      });
      return tiposWithDefinition
    }

    function extractDataFromMergedDefinition(tipoDefinition, tipoData){
      if(tipoDefinition.tipo_fields){
        _.each(tipoDefinition.tipo_fields, function(field){
          var fieldKey = field.field_name;
          var fieldType = field.field_type;
          var fieldValue = field._value;
          var hasValue = !_.isEmpty(fieldValue);
          var isArray = Boolean(_.get(field, '_ui.isArray'));
          var isGroup = Boolean(_.get(field, '_ui.isGroup'));
          var isRelatedTipo = Boolean(_.get(field, '_ui.isTipoRelationship'));
          var hasSimpleValue = !_.isNil(_.get(fieldValue, 'key'));
          if(isRelatedTipo && !isGroup){
            if(hasValue){
              if(isArray){
                tipoData[fieldKey] = [];
                _.each(fieldValue, function(each){
                  tipoData[fieldKey].push(each.key);
                  if(!_.isUndefined(field.label_field)){
                    _.set(tipoData, fieldKey + '_refs.ref' + each.key, each.label);
                  }
                });
              }else{
                if(hasSimpleValue){
                  tipoData[fieldKey] = fieldValue.key;
                  if(!_.isUndefined(field.label_field)){
                    _.set(tipoData, fieldKey + '_refs.ref' + fieldValue.key, fieldValue.label);
                  }
                }
              }
            }
            if(!isValidValue(tipoData[fieldKey]) && field._hadValueOriginally){
              tipoData[fieldKey] = null;
            }
          }
          else if(isGroup){
            var groupData;
            if(isArray){
              if(!_.isEmpty(field._items)){
                groupData = [];
                _.each(field._items, function(item){
                  var itemData = {};
                  if(item._ui.hash){
                    // existing item, so add the hash
                    itemData._ARRAY_META = {
                      _HASH: item._ui.hash
                    };
                  }
                  if(item._ui.deleted){
                    itemData._ARRAY_META._STATUS = 'DELETED';
                    groupData.push(itemData);
                  }else{
                    extractDataFromMergedDefinition(item, itemData);
                    if(!_.isEmpty(itemData)){
                      groupData.push(itemData);
                    }else if(item._ui.hash){
                      itemData._ARRAY_META._STATUS = 'DELETED';
                      groupData.push(itemData);
                    }
                  }
                });
                if(!_.isEmpty(groupData)){
                  tipoData[fieldKey] = groupData;
                }
              }
            }else{
              groupData = {};
              extractDataFromMergedDefinition(field, groupData);
              if(!_.isEmpty(groupData)){
                tipoData[fieldKey] = groupData;
              }
            }
          }else{
            if(hasValue){
              var finalValue;
              if(isArray){
                tipoData[fieldKey] = [];
                _.each(fieldValue, function(each){
                  finalValue = translateSimpleValue(field, each.key);
                  if(finalValue){
                    tipoData[fieldKey].push(translateSimpleValue(field, each.key));
                  }
                });
              } else {
                tipoData[fieldKey] = translateSimpleValue(field, fieldValue.key);
              }
            }
            if(!isValidValue(tipoData[fieldKey]) && field._hadValueOriginally){
              tipoData[fieldKey] = null;
            }
          }
        });
      }
    }

    function isValidValue(value){
      if(_.isBoolean(value)){
        return true;
      }else if(_.isDate(value)){
        return true;
      }else{
        return !_.isEmpty(value);
      }
    }

    function translateSimpleValue(field, value){
      if(!_.isUndefined(value)){
        var fieldType = field.field_type;
        if(fieldType === 'date_time'){
          if(_.isDate(value)){
            return value;
          }
        }
      }
      return value;
    }

    function getFieldValue(tipo, expression){
      if(expression.indexOf('[') === -1){
        // simple extraction without any arrays
        return _.get(tipo, expression);
      }else{
        var value;
        // more elaborate extraction
        var firstPart = expression.substring(0, expression.indexOf('['));
        value = _.get(tipo, firstPart);
        if(!_.isUndefined(value)){
          var indexPart = expression.substring(expression.indexOf('[') + 1, expression.indexOf(']'));
          // need to standardize the index, else quite impossible to derive the value
          // value = _.find(value, {TipoID: indexPart});
          value = value[parseInt(indexPart, 10)];
          if(!_.isUndefined(value)){
            var remainingPart = expression.substring(expression.indexOf(']') + 2);
            if(!_.isEmpty(remainingPart)){
              value = getFieldValue(value, remainingPart);
            }
          }
        }
        return value;
      }
    }

    function generateGroupItem(groupField){
      var itemField = {
        display_name: groupField.display_name,
        tipo_fields: _.cloneDeep(groupField.tipo_fields),
        _ui: {
          isGroupItem: true
        }
      };
      groupField._items = groupField._items || [];
      groupField._items.push(itemField);
      return itemField;
    }

    function resolveTemplateUrl(templateId){
      var parts = templateId.split('.');
      var folders = _.initial(parts);
      var file = _.last(parts);
      return folders.join('/') + '/_views/' + file + '.tpl.html';
    }

    function getPrimaryKey(tipoDefinition){
      return _.find(tipoDefinition.tipo_fields, function(each){
        return each.field_name === 'tipo_id';
      });
    }

    function getMeaningfulKey(tipoDefinition){
      return _.find(tipoDefinition.tipo_fields, function(each){
        return Boolean(each.meaningful_key);
      });
    }

    function getLabel(tipoDefinitionWithData){
      var labelField = getMeaningfulKey(tipoDefinitionWithData) || getPrimaryKey(tipoDefinitionWithData);
      return labelField._value.key;
    }

    function getFieldMeta(field, key){
      return _.get(_.find(field.metadata, {key_: key}), 'value_');
    }

    function cloneInstance(tipo){
      tipo = angular.copy(tipo);
      delete tipo.tipo_id;
      return tipo;
    }

    function extractContextualData(tipoDefinition, subTipoDefinition){
      var parentTipoName = tipoDefinition.tipo_meta.tipo_name;
      var keyField = getPrimaryKey(tipoDefinition);
      var labelField = getMeaningfulKey(tipoDefinition);
      var associationField = _.find(subTipoDefinition.tipo_fields, function(each){
        return each.field_type === 'Tipo.' + parentTipoName;
      });
      var contextualData = {};
      contextualData[associationField.field_name] = keyField._value.key;
      if(!_.isUndefined(labelField)){
        _.set(contextualData, associationField.field_name + '_refs.ref' + keyField._value.key, labelField._value.key);
      }
      return contextualData;
    }

    function expandFilterExpression(filterExpression, tipo, context){
      var tipoData = {};
      if(!_.isUndefined(tipo)){
        if(_.get(tipo, '_ui.isDefinition')){
          extractDataFromMergedDefinition(tipo, tipoData);
        }else{
          tipoData = _.cloneDeep(tipo);
        }
        if(!_.isUndefined(context)){
          if(context._ui){
            var contextData = {};
            extractDataFromMergedDefinition(context, contextData);
            tipoData['this'] = contextData;
          }
        }
        filterExpression = Mustache.render(filterExpression, tipoData);
      }
      return filterExpression;
    }

    function prepareMenu(perspective, definition){

      var menuItems = _.map(definition.tipo_menu, function(each){
        var menuItem = {};
        var parts = each.type_.split('.');
        var isTipo = parts[0] === 'Tipo';
        var isSingleton = parts.length > 2 && parts[2] === 'default';
        menuItem.type = parts[0];
        menuItem.id = parts[1];
        menuItem.label = each.label;
        menuItem.icon = each.icon;
        menuItem.sequence = each.sequence;
        menuItem.isSingleton = isSingleton;
        if(isTipo){
          menuItem.tipo_name = parts[1];
          menuItem.perspective = perspective;
        }
        menuItem.quickFilters = each.quick_filters;
        return menuItem;
      });

      menuItems = _.sortBy(menuItems, function(each){
        if(each.sequence){
          return parseFloat(each.sequence, 10);
        }else{
          return 999;
        }
      });

      return menuItems;
    }

    function resolvePerspectiveMetadata(perspective){
      perspective = perspective || $rootScope.perspective;
      var parts = perspective.split('.');
      var tipoName = parts[0];
      var tipoDefinition = tipoRegistry.get(tipoName);

      var metadata = {
        perspective: perspective,
        tipoName: tipoName,
        displayName: tipoDefinition.tipo_meta.display_name
      };

      if(parts.length > 1){
        var tipoId = parts[1];
        if(tipoId === 'default'){
          metadata.singleton = true;
        }else{
          var fieldName = tipoDefinition.tipo_meta.perspective_field_name || _.snakeCase(tipoName);
          metadata.fieldName = fieldName;
          metadata.tipoFilter = '(' + fieldName + ':(' + tipoId + '))';
        }
      }else{
        metadata.abstract = true;
      }

      return metadata;
    }

    function modifyTipoData(tipoData){
      _.forOwn(tipoData, function(value, key){
        if (!_.isArray(value) && !_.isObject(value)) {
          if( _.isEmpty(value) && value!== false && value !== true){
            tipoData[key] = null;
          }else{
            if (_.isUndefined(value)) {
              delete tipoData[key];
            };
          };
        }
        if (_.isObject(value)) {
          modifyTipoData(value);
        };
        if (_.isArray(value)) {
          _.each(value,function(val){
            modifyTipoData(val);
          });
        };
      });
    }

    function convertToFilterExpression(tipoDefinition, filterName){
      var tipoFilters = _.get(tipoDefinition, 'tipo_list.filters');
      if (!_.isUndefined(filterName)) {
        var filterArray = filterName.split("&&");
      }
      else{
        var filterArray = [];
      }
      var expressionArray = [];
      var filters = _.map(tipoFilters, function(each){
        var selected = false;
        if (filterArray.indexOf(each.display_name) != -1 ) {
          selected = true;
          expressionArray.push(each.filter_expression);
        }
        var filter = {
          name: each.display_name,
          expression: each.filter_expression,
          hidden: each.hidden_,
          selected: selected
        };
        return filter;
      });
      return {filters: filters, currentExpression: expressionArray.join(" and ")};
    }

    // Expose the functions that need to be consumed from outside
    this.extractShortDisplayFields = extractShortDisplayFields;
    this.getFieldValue = getFieldValue;
    this.mergeDefinitionAndData = mergeDefinitionAndData;
    this.mergeDefinitionAndDataArray = mergeDefinitionAndDataArray;
    this.extractDataFromMergedDefinition = extractDataFromMergedDefinition;
    this.generateGroupItem = generateGroupItem;
    this.getPrimaryKey = getPrimaryKey;
    this.getMeaningfulKey = getMeaningfulKey;
    this.getLabel = getLabel;
    this.resolveTemplateUrl = resolveTemplateUrl;
    this.cloneInstance = cloneInstance;
    this.extractContextualData = extractContextualData;
    this.expandFilterExpression = expandFilterExpression;
    this.prepareMenu = prepareMenu;
    this.resolvePerspectiveMetadata = resolvePerspectiveMetadata;
    this.convertToFilterExpression = convertToFilterExpression;
    this.getFieldMeta = getFieldMeta;
    this.modifyTipoData = modifyTipoData;

  }

  angular.module('tipo.framework')
    .service('tipoManipulationService', TipoManipulationService);

})();