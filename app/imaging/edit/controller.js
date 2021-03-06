import AbstractEditController from 'hospitalrun/controllers/abstract-edit-controller';
import ChargeActions from 'hospitalrun/mixins/charge-actions';
import Ember from 'ember';
import PatientSubmodule from 'hospitalrun/mixins/patient-submodule';

export default AbstractEditController.extend(ChargeActions, PatientSubmodule, {
  imagingController: Ember.inject.controller('imaging'),

  chargePricingCategory: 'Imaging',
  chargeRoute: 'imaging.charge',
  selectedImagingType: null,

  canComplete: function() {
    var isNew = this.get('model.isNew'),
      imagingTypeName = this.get('model.imagingTypeName'),
      selectedImagingType = this.get('selectedImagingType');
    if (isNew && (Ember.isEmpty(imagingTypeName) || Ember.isArray(selectedImagingType) && selectedImagingType.length > 1)) {
      return false;
    } else {
      return this.currentUserCan('complete_imaging');
    }
  }.property('selectedImagingType.[]', 'model.imagingTypeName'),

  actions: {
    completeImaging: function() {
      this.set('model.status', 'Completed');
      this.get('model').validate().then(function() {
        if (this.get('model.isValid')) {
          this.set('model.imagingDate', new Date());
          this.send('update');
        }
      }.bind(this)).catch(Ember.K);
    },

    /**
     * Save the imaging request(s), creating multiples when user selects multiple imaging tests.
     */
    update: function() {
      if (this.get('model.isNew')) {
        var newImaging = this.get('model'),
          selectedImagingType = this.get('selectedImagingType');
        if (Ember.isEmpty(this.get('model.status'))) {
          this.set('model.status', 'Requested');
        }
        this.set('model.requestedBy', newImaging.getUserName());
        this.set('model.requestedDate', new Date());
        if (Ember.isEmpty(selectedImagingType)) {
          this.saveNewPricing(this.get('model.imagingTypeName'), 'Imaging', 'model.imagingType').then(function() {
            this.addChildToVisit(newImaging, 'imaging', 'Imaging').then(function() {
              this.saveModel();
            }.bind(this));
          }.bind(this));
        } else {
          this.getSelectedPricing('selectedImagingType').then(function(pricingRecords) {
            if (Ember.isArray(pricingRecords)) {
              this.createMultipleRequests(pricingRecords, 'imagingType', 'imaging', 'Imaging');
            } else {
              this.set('model.imagingType', pricingRecords);
              this.addChildToVisit(newImaging, 'imaging', 'Imaging').then(function() {
                this.saveModel();
              }.bind(this));
            }
          }.bind(this));
        }
      } else {
        this.saveModel();
      }
    }
  },

  additionalButtons: function() {
    var canComplete = this.get('canComplete'),
      isValid = this.get('model.isValid');
    if (isValid && canComplete) {
      return [{
        buttonAction: 'completeImaging',
        buttonIcon: 'glyphicon glyphicon-ok',
        class: 'btn btn-primary on-white',
        buttonText: 'Complete'
      }];
    }
  }.property('canComplete', 'model.isValid'),

  lookupListsToUpdate: [{
    name: 'radiologistList',
    property: 'model.radiologist',
    id: 'radiologists'
  }],

  pricingTypeForObjectType: 'Imaging Procedure',
  pricingTypes: Ember.computed.alias('imagingController.imagingPricingTypes'),

  pricingList: null, // This gets filled in by the route

  radiologistList: Ember.computed.alias('imagingController.radiologistList'),

  updateCapability: 'add_imaging',

  afterUpdate: function(saveResponse, multipleRecords) {
    this.updateLookupLists();
    var afterDialogAction,
      alertTitle,
      alertMessage;
    if (this.get('model.status') === 'Completed') {
      alertTitle = 'Imaging Request Completed';
      alertMessage = 'The imaging request has been completed.';
    } else {
      alertTitle = 'Imaging Request Saved';
      alertMessage = 'The imaging request has been saved.';
    }
    if (multipleRecords) {
      afterDialogAction = this.get('cancelAction');
    }
    this.saveVisitIfNeeded(alertTitle, alertMessage, afterDialogAction);
    this.set('model.selectPatient', false);
  }

});
