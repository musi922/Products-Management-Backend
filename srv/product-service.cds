using { com.products.manager.cap as my } from '../db/schema';

service ProductService {

    entity Products as projection on my.Products;

}