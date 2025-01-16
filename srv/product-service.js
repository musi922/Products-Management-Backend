const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const SECRET_KEY = process.env.SECRET_KEY || 'default-secret-key-for-development';

module.exports = cds.service.impl(async function () {
    const { Products, Cart, Users } = this.entities;

    // Initialize admin user
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

    // Login endpoint
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

    // Authentication middleware
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

    // Access control
    this.before(['CREATE', 'UPDATE', 'DELETE'], 'Products', req => {
        if (req.user.role !== 'admin') return req.error(403, 'Admin access required');
    });

    this.before(['READ', 'CREATE', 'DELETE'], 'Cart', req => {
        if (req.user.role !== 'user') return req.error(403, 'User access required');
    });

    // Product management
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

    // Cart operations
    this.on('addToCart', async req => {
        if (req.user.role !== 'user') return req.error(403, 'User access required');

        const { ProductId } = req.data;
        try {
            const product = await SELECT.from(Products).where({ ProductId, isInCart: false });
            if (!product.length) return req.error(404, 'Product not found or already in cart');

            await UPDATE(Products).set({ isInCart: true }).where({ ProductId });
            
            return await INSERT.into(Cart).entries({
                CartId: cds.utils.uuid(),
                product_ProductId: ProductId,
                quantity: 1,
                dateAdded: new Date()
            });
        } catch (error) {
            return req.error(500, 'Failed to add to cart');
        }
    });

    this.on('getCartItems', async req => {
        if (req.user.role !== 'user') {
            return req.error(403, 'User access required');
        }

        return cds.transaction(req).read(Cart, c => {
            c('*', c.product_ProductId('*'));
        });
    });

    // Create user
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