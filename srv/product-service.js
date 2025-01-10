
module.exports = cds.service.impl(async function () {
    const { Cart, Products } = this.entities;

    this.on('addToCart', async req => {
        const { ProductId } = req.data;
        const tx = cds.transaction(req);

        const product = await tx.read(Products).where({ ProductId , isInCart: false});
        if (!product.length) {
            return req.error('Product not found');
        }
        
        await tx.update(Products)
        .set({ isInCart: true })
        .where({ ProductId: ProductId });

        const cartItem = {
            CartId: cds.utils.uuid(),
            product_ProductId: {ProductId},
            quantity: 1,
            dateAdded: new Date(),
        };
        console.log("Cart Item Added:", cartItem);

    await tx.create(Cart).entries(cartItem);
    return { success: true };

        
    });
    this.before('DELETE', 'Cart', async (req) => {
        const tx = cds.transaction(req);
        const { CartId } = req.data;
        
        try {
            const cartItem = await tx.read(Cart).where({ CartId });
            console.log("Found cart item:", cartItem); 
            
            if (!cartItem.length) {
                return req.error(404, "Cart item not found");
            }
            
            const productId = cartItem[0].product_ProductId_ProductId
            console.log("Product ID to update:", productId); 
            
            await tx.update(Products)
        .set({ isInCart: false })
        .where({ ProductId: productId });

                
            console.log("Updated product isInCart flag", productId); 
            
        } catch (error) {
            console.error("Delete error:", error);
            return req.error(500, "Failed to process delete request");
        }
    });
    

    this.on('getCartItems', async req => {
        const tx = cds.transaction(req);
        return tx.read(Cart, c=> {
            c('*', c.product_ProductId('*'));
        });
    })
});
