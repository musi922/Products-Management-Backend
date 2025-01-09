namespace com.products.manager.cap;

entity Products {
    key ProductId : String(10) @title: 'Product ID';
    category: String;
    mainCategory: String;
    taxTarifCode: String;
    supplierName: String;
    weightMeasure: Decimal;
    weightUnit: String;
    description: String;
    name: String;
    dateOfSale: Date;
    productPicUrl: String;
    status: String;
    quantity: Integer;
    uoM: String;
    currencyCode: String;
    price: Decimal;
    width: Decimal;
    depth: Decimal;
    height: Decimal;
    dimUnit: String;    
    rating: Integer;
}
