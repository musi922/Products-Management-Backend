
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

    this.before('DELETE', 'Cart', async req => {
        if (!req.data.CartId) {
            return req.error(400, "CartId is required");
        }
        return {success: true};
    });
    

    this.on('getCartItems', async req => {
        const tx = cds.transaction(req);
        return tx.read(Cart, c=> {
            c('*', c.product_ProductId('*'));
        });
    })
});
