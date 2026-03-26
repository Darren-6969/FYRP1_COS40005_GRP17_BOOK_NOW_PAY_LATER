import React from 'react';
// import { Alert, AlertDescription } from '../../components/ui/alert';
// import { ScrollArea } from '../../components/ui/scroll-area';
// import { Card } from '../../components/ui/card';
// import { Button } from '../../components/ui/button';
import { X, Check, AlertCircle } from 'lucide-react';

const SuggestPropertiesModal = ({
  properties = [],
  selectedProperty,
  onPropertySelect,
  onConfirm,
  onClose
}) => {
  if (!properties.length) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">No Properties Available</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              There are no properties available to suggest at this moment.
            </AlertDescription>
          </Alert>
          
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Select A Property To Suggest</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ScrollArea className="h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((property) => (
              <Card
                key={property.propertyID}
                className={`relative p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  selectedProperty === property.propertyID ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => onPropertySelect(property.propertyID)}
              >
                {selectedProperty === property.propertyID && (
                  <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
                
                <div className="relative aspect-video mb-3">
                  <img
                    src={`data:image/jpeg;base64,${property.images[0]}`}
                    alt={property.propertyName}
                    className="rounded-lg object-cover w-full h-full"
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-lg line-clamp-1" title={property.propertyName}>
                    {property.propertyName}
                  </h3>
                  
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{property.propertyGuestPaxNo} Pax</span>
                    <span className="font-semibold text-black">
                      RM {property.propertyPrice}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={!selectedProperty}
          >
            Confirm Selection
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SuggestPropertiesModal;