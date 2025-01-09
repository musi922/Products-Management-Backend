using { com.products.manager.cap as my } from '../db/schema';

service ProductService {

    entity Products as projection on my.Products;
    entity Cart as projection on my.Cart;

    action addToCart(ProductId: String) returns Cart;
    function getCartItems() returns array of Cart;
    

}