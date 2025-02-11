const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const SECRET_KEY = process.env.SECRET_KEY || 'default-secret-key-for-development';

module.exports = cds.service.impl(async function () {
    const { Products, Cart, Users } = this.entities;

    try {
        const adminExists = await SELECT.from(Users).where({ username: 'admin' });
        
        if (adminExists.length === 0) {
            const hashedPassword = await bcrypt.hash('adminpassword', 10);
            await INSERT.into(Users).entries({
                ID: cds.utils.uuid(),
                username: 'admin',
                password: hashedPassword,
                role: 'admin'
            });
            console.log('Admin user created');
        }
    } catch (error) {
        console.error('Error initializing admin:', error);
    }

    this.on('login', async req => {
        const { username, password } = req.data;
        
        try {
            const user = await SELECT.from(Users).where({ username });
            
            if (!user.length || !(await bcrypt.compare(password, user[0].password))) {
                return req.error(401, 'Invalid credentials');
            }

            const token = jwt.sign(
                { id: user[0].ID, username: user[0].username, role: user[0].role },
                SECRET_KEY,
                { expiresIn: '1h' }
            );
            
            return { token, role: user[0].role };
        } catch (error) {
            return req.error(500, 'Login failed');
        }
    });

    this.before('*', async req => {
        if (req.event === 'login') return;

        const authHeader = req.headers.authorization;
        if (!authHeader) return req.error(401, 'No token provided');

        try {
            const token = authHeader.replace('Bearer ', '');
            req.user = jwt.verify(token, SECRET_KEY);
        } catch {
            return req.error(401, 'Invalid token');
        }
    });

    this.before(['CREATE', 'UPDATE', 'DELETE'], 'Products', req => {
        if (req.user.role !== 'admin') return req.error(403, 'Admin access required');
    });

    this.before(['READ', 'CREATE', 'DELETE'], 'Cart', req => {
        if (req.user.role !== 'user') return req.error(403, 'User access required');
    });

    this.on('manageProducts', async req => {
        if (req.user.role !== 'admin') return req.error(403, 'Admin access required');

        const { action, productId, updates } = req.data;
        try {
            switch (action) {
                case 'create':
                    return await INSERT.into(Products).entries(updates);
                case 'update':
                    return await UPDATE(Products).with(updates).where({ ProductId: productId });
                case 'delete':
                    return await DELETE.from(Products).where({ ProductId: productId });
                default:
                    return req.error(400, 'Invalid action');
            }
        } catch (error) {
            return req.error(500, 'Product operation failed');
        }
    });

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
    
    

    this.on('getCartItems', async req => {
        if (req.user.role !== 'user') {
            return req.error(403, 'User access required');
        }

        return cds.transaction(req).read(Cart, c => {
            c('*', c.product_ProductId('*'));
        });
    });

    this.on('createUser', async req => {
        if (req.user.role !== 'admin') return req.error(403, 'Admin access required');

        try {
            const { username, password, role } = req.data;
            const hashedPassword = await bcrypt.hash(password, 10);

            await INSERT.into(Users).entries({
                ID: cds.utils.uuid(),
                username,
                password: hashedPassword,
                role
            });

            return { message: 'User created successfully' };
        } catch (error) {
            return req.error(500, 'Failed to create user');
        }
    });
});