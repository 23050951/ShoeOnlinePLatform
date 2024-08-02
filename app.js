const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const app = express();

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// MySQL connection configuration
const connection = mysql.createConnection({
    // host: 'localhost',
    // user: 'root',
    // password: '',
    // database: 'shoeonlineplatform'
    host : 'mysql-benedict.alwaysdata.net',
    user: 'benedict',
    password: 'Hellothere88!',
    database: 'benedict_2024'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Session middleware setup
app.use(session({
    secret: 'your-secret-key', // Change this to a secure key
    resave: false,
    saveUninitialized: true
}));

// Middleware for parsing form data
app.use(express.urlencoded({ extended: false }));

// Custom session handling middleware
app.use((req, res, next) => {
    if (!req.session.user) {
        req.session.user = null;
    }
    next();
});

// Set view engine to EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serve static files from public directory
app.use(express.static('public'));

// Login route
app.get('/login', (req, res) => {
    res.render('login', { error: req.query.error });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE Email = ? AND Password = ?';

    connection.query(sql, [email, password], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving user');
        }

        if (results.length === 0) {
            return res.redirect('/login?error=Invalid email or password');
        }

        const user = results[0];
        req.session.user = user; // Store user information in session
        res.redirect('/dashboard'); // Redirect to dashboard or any authenticated page
    });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    const sql = 'INSERT INTO users (Username, Email, Password) VALUES (?, ?, ?)';
    connection.query(sql, [username, email, password], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error registering user');
        }
        res.redirect('/login');
    });
});

app.get('/orders', (req, res) => {
    const sql = 'SELECT o.OrderID, p.Name AS ProductName, o.Quantity, o.Price, o.Status, o.OrderDate FROM orders o JOIN products p ON o.ProductID = p.ProductID';
    connection.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving orders');
        }
        res.render('order', { orders: results });
    });
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.redirect('/login'); // Redirect to login if user is not authenticated
    }
    res.render('dashboard', { user });
});

// Routes for handling product operations (addProduct, editProduct, deleteProduct, etc.)
app.get('/products', (req, res) => {
    const { brand, price, search } = req.query;

    let query = 'SELECT * FROM products';

    if (brand) {
        query += ` WHERE Brand = '${brand}'`;
    }

    if (price) {
        if (price === 'low-to-high') {
            query += ' ORDER BY Price ASC';
        } else if (price === 'high-to-low') {
            query += ' ORDER BY Price DESC';
        }
    }

    if (search) {
        query += ` WHERE Name LIKE '%${search}%' OR Description LIKE '%${search}%'`;
    }

    connection.query(query, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error retrieving products');
        } else {
            const brandQuery = 'SELECT DISTINCT Brand FROM products';
            connection.query(brandQuery, (err, brandResults) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error retrieving brands');
                } else {
                    const brands = brandResults.map((brand) => brand.Brand);
                    res.render('products', { products: results, brands: brands });
                }
            });
        }
    });
});

app.get('/product/:id', (req, res) => {
    const productId = req.params.id;
    const sql = 'SELECT * FROM products WHERE ProductID = ?';
    connection.query(sql, [productId], (error, results) => {
      if (error) {
        console.error('Error retrieving product:', error);
        res.status(500).send('Error retrieving product');
        return;
      }
  
      if (results.length === 0) {
        res.status(404).send('Product not found');
        return;
      }
  
      const product = results[0];
      res.render('product', { product, title: product.Name }); // Pass the product title to the view
    });
});

// Add Product routes
app.get('/addProduct', (req, res) => {
    res.render('addProduct');
});

app.post('/addProduct', upload.single('image'), (req, res) => {
    const { brand, name, description, price, size, quantity } = req.body;
    let shoePicture = req.file ? req.file.filename : null;

    const sql = 'INSERT INTO products (Brand, Name, Description, Price, Size, Quantity, ShoePicture) VALUES (?, ?, ?, ?, ?, ?, ?)';
    connection.query(sql, [brand, name, description, price, size, quantity, shoePicture], (error, results) => {
        if (error) {
            console.error('Error adding product:', error);
            res.status(500).send('Error adding product');
        } else {
            res.redirect('/products');
        }
    });
});

// Edit Product routes
app.get('/editProduct/:id', (req, res) => {
    const productId = req.params.id;
    const sql = 'SELECT * FROM products WHERE ProductID = ?';
    connection.query(sql, [productId], (error, results) => {
        if (error) {
            console.error('Error retrieving product:', error);
            return res.status(500).send('Error retrieving product');
        }
        res.render('editProduct', { product: results[0] });
    });
});

app.post('/editProduct/:id', upload.single('image'), (req, res) => {
    const productId = req.params.id;
    const { brand, name, description, price, size, quantity } = req.body;
    let shoePicture = req.body.currentImage;
    if (req.file) {
      shoePicture = req.file.filename;
    }
  
    const sql = 'UPDATE products SET Brand = ?, Name = ?, Description = ?, Price = ?, Size = ?, Quantity = ?, ShoePicture = ? WHERE ProductID = ?';
    connection.query(sql, [brand, name, description, price, size, quantity, shoePicture, productId], (error, results) => {
      if (error) {
        console.error('Error updating product:', error);
        res.status(500).send('Error updating product');
        return;
      }
  
      res.redirect('/products');
    });
  });

// Update product route
app.post('/updateProduct/:id', (req, res) => {
    const productId = req.params.id;
    const { name, description, price, quantity } = req.body;
    const sql = 'UPDATE products SET Name = ?, Description = ?, Price = ?, Quantity = ? WHERE ProductID = ?';
    connection.query(sql, [name, description, price, quantity, productId], (error, results) => {
        if (error) {
            console.error('Error updating product:', error);
            return res.status(500).send('Error updating product');
        }
        res.redirect('/products');
    });
});

// Delete product route
app.get('/deleteProduct/:id', (req, res) => {
    const productId = req.params.id;
    const sql = 'DELETE FROM products WHERE ProductID = ?';
    connection.query(sql, [productId], (error, results) => {
        if (error) {
            console.error('Error deleting product:', error);
            return res.status(500).send('Error deleting product');
        }
        res.redirect('/products');
    });
});

app.get('/cart', (req, res) => {
    const user = req.session.user;
    const cart = req.session.cart;

    if (!user) {
        return res.redirect('/login');
    }

    let subtotal = 0;
    cart.items.forEach((item) => {
        subtotal += item.product.Price * item.quantity;
    });

    res.render('cart', { user: user, cart: cart });
});

app.get('/addToCart/:id', (req, res) => {
    const productId = req.params.id;
    const quantity = req.query.quantity || 1; // default to 1 if no quantity is provided
    const sql = 'SELECT * FROM products WHERE ProductID =?';
    connection.query(sql, [productId], (error, results) => {
        if (error) {
            console.error('Error retrieving product:', error);
            res.status(500).send('Error retrieving product');
            return;
        }

        if (results.length === 0) {
            res.status(404).send('Product not found');
            return;
        }

        const product = results[0];

        if (!req.session.cart) {
            req.session.cart = { items: [], subtotal: 0 };
        }

        const cart = req.session.cart;
        const existingItem = cart.items.find((item) => item.product.ProductID === product.ProductID);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.items.push({ product, quantity });
        }

        cart.subtotal += product.Price * quantity;

        res.redirect('/cart'); // Redirect to the cart page
    });
});

app.post('/payment', (req, res) => {
    // Create a new order object
    const order = {
      OrderID: 123,
      OrderDate: new Date(),
      Status: 'pending',
    };
  
    // Create an array of order items
    const orderItems = [
      { Quantity: 2, ProductID: 'Product 1', Price: 10.99 },
      { Quantity: 1, ProductID: 'Product 2', Price: 9.99 },
    ];
  
    // Store the order and orderItems in the session
    req.session.order = order;
    req.session.orderItems = orderItems;
  
    res.redirect('/order-confirmation');
  });
  
app.get('/checkout', (req, res) => {
    const user = req.session.user;
    const cart = req.session.cart;
  
    if (!user) {
      return res.redirect('/login');
    }
  
    // Create a new order in the database
    const sql = 'INSERT INTO orders (UserID, OrderDate, Status) VALUES (?,?,?)';
    connection.query(sql, [user.UserID, new Date(), 'pending'], (error, results) => {
      if (error) {
        console.error('Error creating order:', error);
        return res.status(500).send('Error creating order');
      }
  
      const orderId = results.insertId;
  
      // Add order items to the database
      cart.items.forEach((item) => {
        const sql = 'INSERT INTO orders (OrderID, ProductID, Quantity, Price) VALUES (?,?,?,?)';
        connection.query(sql, [orderId, item.product.ProductID, item.quantity, item.product.Price], (error) => {
          if (error) {
            console.error('Error adding order item:', error);
          }
        });
      });
  
      // Clear the cart
      req.session.cart = {};
  
      // Store the order ID in the session
      req.session.orderId = orderId;
  
      res.redirect('/order-confirmation');
    });
});
  
app.get('/order-confirmation', (req, res) => {
    const order = req.session.order;
    const orderItems = req.session.orderItems;

    // Convert the OrderDate string back to a Date object
    order.OrderDate = new Date(order.OrderDate);
  
    res.render('order-confirmation', {
      order,
      orderItems,
    });
});

// Update the /products route to render the filtered products
app.get('/products', (req, res) => {
    res.render('products', { products: [] }); // render an empty products array
});


// Filter search route
app.get('/filter', (req, res) => {
    const { brand, price, search } = req.query;

    let query = 'SELECT * FROM products';

    if (brand && brand!== 'All') {
        query += ` WHERE Brand = '${brand}'`;
    }

    if (price) {
        if (price === 'low-to-high') {
            query += 'RDER BY Price ASC';
        } else if (price === 'high-to-low') {
            query += 'RDER BY Price DESC';
        }
    }

    if (search) {
        if (query.includes('WHERE')) {
            query += ` AND (Name LIKE '%${search}%' OR Description LIKE '%${search}%')`;
        } else {
            query += ` WHERE (Name LIKE '%${search}%' OR Description LIKE '%${search}%')`;
        }
    }

    connection.query(query, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error retrieving products');
        } else {
            const brandQuery = 'SELECT DISTINCT Brand FROM products';
            connection.query(brandQuery, (err, brandResults) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error retrieving brands');
                } else {
                    const brands = brandResults.map((brand) => brand.Brand);
                    res.render('products', { products: results, brands: brands, brand: req.query.brand, price: req.query.price, search: req.query.search });
                }
            });
        }
    });
});

//Define logout route
app.get('/logout', (req, res) => {
    req.logout(); // assuming you're using Passport.js for authentication
    res.redirect('/'); // redirect to the homepage after logout
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
      } else {
        res.redirect('/login'); // Redirect to the login page
      }
    });
});

// User profile route
app.get('/userProfile/:id', (req, res) => {
    const userId = req.params.id;
    const sql = 'SELECT * FROM users WHERE UserID = ?';
    connection.query(sql, [userId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving user profile');
        }
        if (results.length > 0) {
            const userProfile = results[0];
            res.render('userProfile', { user: userProfile });
        } else {
            res.status(404).send('User not found');
        }
    });
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));