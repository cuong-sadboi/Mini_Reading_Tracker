const http = require('http');
const url = require('url');
const dotenv = require('dotenv');
const axios = require('axios');
const db = require('./db');

dotenv.config();

const PORT = process.env.PORT || 3000;

// Helper to set CORS headers
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

// Helper to parse JSON body
const parseBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', err => reject(err));
    });
};

// Helper to send JSON response
const sendJson = (res, statusCode, data) => {
    setCorsHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};

const sendError = (res, statusCode, message) => {
    return sendJson(res, statusCode, { error: message });
};

const VALID_STATUSES = ['WANT_TO_READ', 'READING', 'READ'];

const server = http.createServer(async (req, res) => {
    // Handle Preflight OPTIONS
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    try {
        // === Group 1: Proxy Open Library ===

        // GET /api/books/search?q=...&page=1&limit=20
        if (method === 'GET' && pathname === '/api/books/search') {
            const q = parsedUrl.query.q || '';
            const page = parseInt(parsedUrl.query.page) || 1;
            const limit = parseInt(parsedUrl.query.limit) || 20;

            const response = await axios.get(`https://openlibrary.org/search.json`, {
                params: { q, page, limit }
            });
            
            const docs = response.data.docs.map(doc => ({
                key: doc.key,
                title: doc.title,
                author_name: doc.author_name,
                cover_i: doc.cover_i,
                first_publish_year: doc.first_publish_year
            }));

            return sendJson(res, 200, {
                numFound: response.data.numFound,
                start: response.data.start,
                docs: docs
            });
        }

        // GET /api/books/:workId
        const bookDetailMatch = pathname.match(/^\/api\/books\/([^\/]+)$/);
        if (method === 'GET' && bookDetailMatch && pathname !== '/api/books/search') {
            const workId = bookDetailMatch[1];
            const response = await axios.get(`https://openlibrary.org/works/${workId}.json`);
            
            const data = response.data;
            return sendJson(res, 200, {
                key: data.key,
                title: data.title,
                description: typeof data.description === 'string' ? data.description : data.description?.value || '',
                subjects: data.subjects || [],
                covers: data.covers || [],
            });
        }

        // === Group 2: Library CRUD ===

        // GET /api/library/stats
        if (method === 'GET' && pathname === '/api/library/stats') {
            const [rows] = await db.execute(`
                SELECT 
                    COUNT(*) as totalBooks,
                    SUM(CASE WHEN status = 'READING' THEN 1 ELSE 0 END) as readingBooks,
                    SUM(CASE WHEN status = 'READ' THEN 1 ELSE 0 END) as readBooks
                FROM books
            `);
            return sendJson(res, 200, rows[0]);
        }

        // GET /api/library
        if (method === 'GET' && pathname === '/api/library') {
            const status = parsedUrl.query.status;
            let query = 'SELECT * FROM books';
            let params = [];
            
            if (status) {
                query += ' WHERE status = ?';
                params.push(status);
            }
            
            query += ' ORDER BY created_at DESC';
            
            const [rows] = await db.execute(query, params);
            return sendJson(res, 200, rows);
        }

        // POST /api/library
        if (method === 'POST' && pathname === '/api/library') {
            const body = await parseBody(req);
            const { workId, title, author, coverUrl, description, totalPages, publishedYear, subjects, status } = body;
            
            if (!workId || typeof workId !== 'string' || workId.trim() === '') {
                return sendError(res, 400, 'Invalid or missing workId. It must be a non-empty string.');
            }
            if (!title || typeof title !== 'string' || title.trim() === '') {
                return sendError(res, 400, 'Invalid or missing title. It must be a non-empty string.');
            }
            if (status && !VALID_STATUSES.includes(status)) {
                return sendError(res, 400, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
            }
            if (totalPages !== undefined && totalPages !== null) {
                if (typeof totalPages !== 'number' || totalPages <= 0 || !Number.isInteger(totalPages)) {
                    return sendError(res, 400, 'Invalid totalPages. It must be a positive integer.');
                }
            }
            
            const finalStatus = status || 'WANT_TO_READ';

            const [existing] = await db.execute('SELECT id FROM books WHERE open_library_work_id = ?', [workId]);
            if (existing.length > 0) {
                return sendError(res, 409, 'Book already exists in the library.');
            }
            
            let started_at = null;
            let finished_at = null;
            
            if (finalStatus === 'READING') {
                started_at = new Date();
            } else if (finalStatus === 'READ') {
                started_at = new Date();
                finished_at = new Date();
            }

            const [result] = await db.execute(
                `INSERT INTO books 
                (open_library_work_id, title, author, cover_url, description, total_pages, published_year, subjects, status, started_at, finished_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    workId, title, author || null, coverUrl || null, description || null, 
                    totalPages || null, publishedYear || null, 
                    subjects ? JSON.stringify(subjects) : null, 
                    finalStatus, started_at, finished_at
                ]
            );
            
            return sendJson(res, 201, { id: result.insertId, message: 'Book added to library' });
        }

        // PATCH /api/library/:id
        const libraryIdMatch = pathname.match(/^\/api\/library\/([^\/]+)$/);
        if (method === 'PATCH' && libraryIdMatch) {
            const id = libraryIdMatch[1];
            const body = await parseBody(req);
            const { currentPage, status, rating, note, totalPages } = body;
            
            const [books] = await db.execute('SELECT * FROM books WHERE id = ?', [id]);
            if (books.length === 0) {
                return sendError(res, 404, 'Book not found.');
            }
            const book = books[0];
            
            let newStatus = status !== undefined ? status : book.status;
            let newCurrentPage = currentPage !== undefined ? currentPage : book.current_page;
            let newRating = rating !== undefined ? rating : book.rating;
            let newNote = note !== undefined ? note : book.note;
            let newTotalPages = totalPages !== undefined ? totalPages : book.total_pages;
            
            // Validate rating
            if (newRating !== null) {
                if (typeof newRating !== 'number' || !Number.isInteger(newRating) || newRating < 1 || newRating > 5) {
                    return sendError(res, 400, 'Invalid rating. It must be an integer between 1 and 5, or null.');
                }
            }
            
            // Validate status
            if (!VALID_STATUSES.includes(newStatus)) {
                return sendError(res, 400, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
            }
            
            // Validate totalPages
            if (newTotalPages !== null) {
                if (typeof newTotalPages !== 'number' || !Number.isInteger(newTotalPages) || newTotalPages <= 0) {
                    return sendError(res, 400, 'Invalid totalPages. It must be a positive integer.');
                }
            }
            
            // Validate currentPage
            if (newCurrentPage !== null) {
                if (typeof newCurrentPage !== 'number' || !Number.isInteger(newCurrentPage) || newCurrentPage < 0) {
                    return sendError(res, 400, 'Invalid currentPage. It must be a non-negative integer.');
                }
                if (newTotalPages && newCurrentPage > newTotalPages) {
                    return sendError(res, 400, `Invalid currentPage. It cannot exceed total pages (${newTotalPages}).`);
                }
            }
            
            // Auto-update status based on progress
            if (newTotalPages && newCurrentPage === newTotalPages) {
                newStatus = 'READ';
            }
            
            let newStartedAt = book.started_at;
            let newFinishedAt = book.finished_at;
            
            if (book.status === 'WANT_TO_READ' && newStatus === 'READING') {
                newStartedAt = new Date();
            }
            
            if (book.status !== 'READ' && newStatus === 'READ') {
                newFinishedAt = new Date();
                if (!newStartedAt) newStartedAt = new Date();
            }

            await db.execute(
                `UPDATE books SET 
                    current_page = ?, status = ?, rating = ?, note = ?, started_at = ?, finished_at = ?, total_pages = ?
                 WHERE id = ?`,
                [newCurrentPage, newStatus, newRating, newNote, newStartedAt, newFinishedAt, newTotalPages, id]
            );
            
            return sendJson(res, 200, { message: 'Book updated successfully' });
        }

        // DELETE /api/library/:id
        if (method === 'DELETE' && libraryIdMatch) {
            const id = libraryIdMatch[1];
            const [result] = await db.execute('DELETE FROM books WHERE id = ?', [id]);
            
            if (result.affectedRows === 0) {
                return sendError(res, 404, 'Book not found.');
            }
            
            return sendJson(res, 200, { message: 'Book deleted from library' });
        }

        // Route not found
        return sendError(res, 404, 'API Route Not Found.');

    } catch (error) {
        console.error(`Error on ${method} ${pathname}:`, error);
        
        // Return 500 but if axios returned 404 we could also forward it.
        const errorMsg = error.response?.data?.error || 'Internal Server Error. Please try again later.';
        return sendError(res, 500, errorMsg);
    }
});

server.listen(PORT, () => {
    console.log(`Node.js HTTP Server is running on http://localhost:${PORT}`);
});
