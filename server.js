const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const { Server } = require("socket.io");

/* =========================================================
   GRAMDB
   Authentication + Realtime Database + Storage
========================================================= */

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    }
});

/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT || 3000);

const API_KEY =
    process.env.API_KEY ||
    "gramdb_api_key_change_this";

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "gramdb_access_secret_change_this";

const REFRESH_SECRET =
    process.env.REFRESH_SECRET ||
    "gramdb_refresh_secret_change_this";

const DB_FILE =
    path.join(__dirname, "database.json");

const STORAGE_DIR =
    path.join(__dirname, "storage");

const MAX_FILE_SIZE =
    500 * 1024 * 1024;

/*
 * Access token:
 * 30 minutes
 *
 * Refresh token:
 * 30 days
 */

const ACCESS_TOKEN_EXPIRES =
    "30m";

const REFRESH_TOKEN_EXPIRES =
    "30d";

/* =========================================================
   DIRECTORIES
========================================================= */

if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, {
        recursive: true
    });
}

/* =========================================================
   EXPRESS
========================================================= */

app.disable("x-powered-by");

app.set("trust proxy", 1);

app.use(
    cors({
        origin:
            process.env.CORS_ORIGIN || "*",

        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-API-Key"
        ]
    })
);

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

/* =========================================================
   SECURITY HEADERS
========================================================= */

app.use((req, res, next) => {

    res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
    );

    res.setHeader(
        "X-Frame-Options",
        "SAMEORIGIN"
    );

    res.setHeader(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
    );

    res.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()"
    );

    next();
});

/* =========================================================
   DATABASE
========================================================= */

function createDatabase() {

    return {
        users: {},
        data: {},
        files: {},
        refreshTokens: {}
    };
}

function readDB() {

    try {

        if (!fs.existsSync(DB_FILE)) {

            const db =
                createDatabase();

            fs.writeFileSync(
                DB_FILE,
                JSON.stringify(
                    db,
                    null,
                    2
                ),
                "utf8"
            );

            return db;
        }

        const content =
            fs.readFileSync(
                DB_FILE,
                "utf8"
            );

        if (!content.trim()) {

            const db =
                createDatabase();

            saveDB(db);

            return db;
        }

        const db =
            JSON.parse(content);

        db.users =
            db.users || {};

        db.data =
            db.data || {};

        db.files =
            db.files || {};

        db.refreshTokens =
            db.refreshTokens || {};

        return db;

    } catch (error) {

        console.error(
            "DATABASE READ ERROR:",
            error
        );

        throw new Error(
            "Database haisomeki vizuri"
        );
    }
}

/* =========================================================
   ATOMIC DATABASE WRITE
========================================================= */

function saveDB(db) {

    const tempFile =
        DB_FILE +
        "." +
        process.pid +
        "." +
        Date.now() +
        ".tmp";

    fs.writeFileSync(
        tempFile,
        JSON.stringify(
            db,
            null,
            2
        ),
        "utf8"
    );

    fs.renameSync(
        tempFile,
        DB_FILE
    );
}

/* =========================================================
   UTILS
========================================================= */

function generateId(prefix = "id") {

    return (
        prefix +
        "_" +
        crypto.randomUUID()
    );
}

function now() {

    return new Date().toISOString();
}

function normalizeEmail(email) {

    return String(email)
        .trim()
        .toLowerCase();
}

function isObject(value) {

    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function findUserByUid(db, uid) {

    return Object.values(
        db.users
    ).find(
        user =>
            user.uid === uid
    );
}

function sanitizeUser(user) {

    if (!user) {
        return null;
    }

    return {
        uid:
            user.uid,

        email:
            user.email,

        displayName:
            user.displayName || null,

        photoURL:
            user.photoURL || null,

        createdAt:
            user.createdAt,

        updatedAt:
            user.updatedAt
    };
}

/* =========================================================
   PATH SECURITY
========================================================= */

function splitPath(input) {

    const value =
        String(input || "")
            .replace(/^\/+|\/+$/g, "");

    if (!value) {
        return [];
    }

    const parts =
        value.split("/");

    for (const part of parts) {

        if (
            part === "." ||
            part === ".." ||
            part.includes("\\") ||
            part.includes("\0")
        ) {

            throw new Error(
                "Invalid database path"
            );
        }
    }

    return parts;
}

function pathToString(parts) {

    return "/" +
        parts.join("/");
}

/* =========================================================
   API KEY
========================================================= */

function requireApiKey(
    req,
    res,
    next
) {

    const key =
        req.headers["x-api-key"] ||
        req.query.api_key;

    if (
        !key ||
        key !== API_KEY
    ) {

        return res.status(403).json({

            success: false,

            error:
                "API key si sahihi au haipo"
        });
    }

    next();
}

/* =========================================================
   RATE LIMITER
========================================================= */

const rateLimitStore =
    new Map();

function rateLimit(options = {}) {

    const windowMs =
        options.windowMs ||
        60 * 1000;

    const max =
        options.max ||
        60;

    return (req, res, next) => {

        const ip =
            req.ip ||
            req.socket.remoteAddress ||
            "unknown";

        const prefix =
            options.keyPrefix ||
            "general";

        const key =
            prefix +
            ":" +
            ip;

        const current =
            Date.now();

        let record =
            rateLimitStore.get(key);

        if (
            !record ||
            current - record.start >=
                windowMs
        ) {

            record = {
                start: current,
                count: 0
            };
        }

        record.count++;

        rateLimitStore.set(
            key,
            record
        );

        if (
            record.count > max
        ) {

            return res.status(429).json({

                success: false,

                error:
                    "Requests nyingi sana. Tafadhali jaribu tena baadaye."
            });
        }

        next();
    };
}

setInterval(() => {

    const current =
        Date.now();

    for (
        const [key, record]
        of rateLimitStore
    ) {

        if (
            current - record.start >
            10 * 60 * 1000
        ) {

            rateLimitStore.delete(
                key
            );
        }
    }

}, 10 * 60 * 1000);

/* =========================================================
   TOKEN SYSTEM
========================================================= */

/*
 * Kila user ana tokenVersion.
 *
 * Login mpya:
 * tokenVersion inaongezwa.
 *
 * Hii inafanya access tokens za zamani
 * kuwa invalid.
 */

function createAccessToken(user) {

    return jwt.sign(
        {
            uid:
                user.uid,

            email:
                user.email,

            tokenVersion:
                user.tokenVersion || 1
        },
        JWT_SECRET,
        {
            expiresIn:
                ACCESS_TOKEN_EXPIRES
        }
    );
}

function createRefreshToken(user) {

    return jwt.sign(
        {
            uid:
                user.uid,

            tokenVersion:
                user.tokenVersion || 1,

            type:
                "refresh"
        },
        REFRESH_SECRET,
        {
            expiresIn:
                REFRESH_TOKEN_EXPIRES
        }
    );
}

function hashToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function verifyToken(
    req,
    res,
    next
) {

    const authorization =
        req.headers.authorization;

    if (!authorization) {

        return res.status(401).json({

            success: false,

            error:
                "Authorization token inahitajika"
        });
    }

    const parts =
        authorization
            .trim()
            .split(/\s+/);

    if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
    ) {

        return res.status(401).json({

            success: false,

            error:
                "Tumia Authorization: Bearer TOKEN"
        });
    }

    const token =
        parts[1];

    jwt.verify(
        token,
        JWT_SECRET,
        (error, decoded) => {

            if (error) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Token imeisha au si sahihi"
                });
            }

            const db =
                readDB();

            const user =
                findUserByUid(
                    db,
                    decoded.uid
                );

            if (!user) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Account haipatikani"
                });
            }

            /*
             * Hapa tunaua token za zamani.
             */

            if (
                Number(
                    decoded.tokenVersion
                ) !==
                Number(
                    user.tokenVersion
                )
            ) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Session ime-expire. Tafadhali login tena."
                });
            }

            req.user = {

                uid:
                    user.uid,

                email:
                    user.email
            };

            next();
        }
    );
}

/* =========================================================
   DATABASE OBJECT FUNCTIONS
========================================================= */

function getPathObject(
    root,
    parts
) {

    let current =
        root;

    for (
        const part of parts
    ) {

        if (
            current === null ||
            typeof current !==
                "object"
        ) {

            return undefined;
        }

        current =
            current[part];
    }

    return current;
}

function setPathObject(
    root,
    parts,
    value
) {

    if (!parts.length) {

        throw new Error(
            "Empty database path"
        );
    }

    let current =
        root;

    for (
        let i = 0;
        i < parts.length - 1;
        i++
    ) {

        const part =
            parts[i];

        if (
            !current[part] ||
            typeof current[part] !==
                "object" ||
            Array.isArray(
                current[part]
            )
        ) {

            current[part] = {};
        }

        current =
            current[part];
    }

    current[
        parts[
            parts.length - 1
        ]
    ] = value;
}

function deletePathObject(
    root,
    parts
) {

    if (!parts.length) {

        return false;
    }

    let current =
        root;

    for (
        let i = 0;
        i < parts.length - 1;
        i++
    ) {

        if (
            !current[parts[i]]
        ) {

            return false;
        }

        current =
            current[parts[i]];
    }

    const last =
        parts[
            parts.length - 1
        ];

    if (
        Object.prototype
            .hasOwnProperty.call(
                current,
                last
            )
    ) {

        delete current[last];

        return true;
    }

    return false;
}

/* =========================================================
   ROOT
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            service:
                "GramDB",

            version:
                "1.0.0",

            message:
                "GramDB API is running",

            features: [

                "Authentication",

                "Realtime Database",

                "Storage",

                "Socket.IO"
            ]
        });
    }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/health",
    (req, res) => {

        res.json({

            success: true,

            service:
                "GramDB",

            status:
                "online",

            authentication:
                true,

            database:
                true,

            realtime:
                true,

            storage:
                true,

            time:
                now()
        });
    }
);

/* =========================================================
   AUTH - SIGNUP
========================================================= */

app.post(
    "/v1/auth/signup",

    requireApiKey,

    rateLimit({
        windowMs:
            15 * 60 * 1000,

        max:
            10,

        keyPrefix:
            "signup"
    }),

    async (req, res) => {

        try {

            const {
                email,
                password,
                displayName,
                photoURL
            } = req.body;

            if (
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Email na password vinahitajika"
                });
            }

            if (
                String(password).length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Password lazima iwe na angalau characters 6"
                });
            }

            const normalizedEmail =
                normalizeEmail(email);

            const db =
                readDB();

            if (
                db.users[
                    normalizedEmail
                ]
            ) {

                return res.status(409).json({

                    success: false,

                    error:
                        "Email hii imeshasajiliwa"
                });
            }

            const uid =
                generateId("user");

            const passwordHash =
                await bcrypt.hash(
                    String(password),
                    12
                );

            const user = {

                uid,

                email:
                    normalizedEmail,

                password:
                    passwordHash,

                displayName:
                    displayName
                        ? String(
                            displayName
                        ).trim()
                        : null,

                photoURL:
                    photoURL
                        ? String(
                            photoURL
                        ).trim()
                        : null,

                tokenVersion:
                    1,

                createdAt:
                    now(),

                updatedAt:
                    now()
            };

            db.users[
                normalizedEmail
            ] = user;

            const accessToken =
                createAccessToken(
                    user
                );

            const refreshToken =
                createRefreshToken(
                    user
                );

            const refreshHash =
                hashToken(
                    refreshToken
                );

            db.refreshTokens[
                refreshHash
            ] = {

                uid:
                    user.uid,

                tokenVersion:
                    user.tokenVersion,

                createdAt:
                    now()
            };

            saveDB(db);

            res.status(201).json({

                success: true,

                uid:
                    user.uid,

                user:
                    sanitizeUser(
                        user
                    ),

                accessToken,

                refreshToken,

                message:
                    "Usajili umefanikiwa"
            });

        } catch (error) {

            console.error(
                "SIGNUP ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                error:
                    "Signup failed"
            });
        }
    }
);

/* =========================================================
   AUTH - SIGNIN
========================================================= */

app.post(
    "/v1/auth/signin",

    requireApiKey,

    rateLimit({
        windowMs:
            15 * 60 * 1000,

        max:
            15,

        keyPrefix:
            "signin"
    }),

    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;

            if (
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Email na password vinahitajika"
                });
            }

            const normalizedEmail =
                normalizeEmail(email);

            const db =
                readDB();

            const user =
                db.users[
                    normalizedEmail
                ];

            if (!user) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Email au password si sahihi"
                });
            }

            const valid =
                await bcrypt.compare(
                    String(password),
                    user.password
                );

            if (!valid) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Email au password si sahihi"
                });
            }

            /*
             * MUHIMU:
             *
             * Login mpya unaua sessions
             * zote za zamani.
             */

            user.tokenVersion =
                Number(
                    user.tokenVersion || 1
                ) + 1;

            user.updatedAt =
                now();

            /*
             * Futa refresh tokens zote
             * za user huyu.
             */

            for (
                const [
                    tokenHash,
                    tokenData
                ]
                of Object.entries(
                    db.refreshTokens
                )
            ) {

                if (
                    tokenData.uid ===
                    user.uid
                ) {

                    delete db
                        .refreshTokens[
                            tokenHash
                        ];
                }
            }

            const accessToken =
                createAccessToken(
                    user
                );

            const refreshToken =
                createRefreshToken(
                    user
                );

            const refreshHash =
                hashToken(
                    refreshToken
                );

            db.refreshTokens[
                refreshHash
            ] = {

                uid:
                    user.uid,

                tokenVersion:
                    user.tokenVersion,

                createdAt:
                    now()
            };

            saveDB(db);

            res.json({

                success: true,

                uid:
                    user.uid,

                user:
                    sanitizeUser(
                        user
                    ),

                accessToken,

                refreshToken,

                message:
                    "Umeingia kwa mafanikio"
            });

        } catch (error) {

            console.error(
                "SIGNIN ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                error:
                    "Signin failed"
            });
        }
    }
);

/* =========================================================
   AUTH - REFRESH
========================================================= */

app.post(
    "/v1/auth/refresh",

    requireApiKey,

    rateLimit({
        windowMs:
            15 * 60 * 1000,

        max:
            30,

        keyPrefix:
            "refresh"
    }),

    (req, res) => {

        try {

            const {
                refreshToken
            } = req.body;

            if (
                !refreshToken
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Refresh token inahitajika"
                });
            }

            const hash =
                hashToken(
                    refreshToken
                );

            const db =
                readDB();

            const stored =
                db.refreshTokens[
                    hash
                ];

            if (!stored) {

                return res.status(401).json({

                    success: false,

                    error:
                        "Refresh token si sahihi au ime-revoke"
                });
            }

            jwt.verify(
                refreshToken,
                REFRESH_SECRET,
                (error, decoded) => {

                    if (error) {

                        delete db
                            .refreshTokens[
                                hash
                            ];

                        saveDB(db);

                        return res.status(401)
                            .json({

                                success: false,

                                error:
                                    "Refresh token imeisha"
                            });
                    }

                    if (
                        decoded.type !==
                        "refresh"
                    ) {

                        return res.status(401)
                            .json({

                                success: false,

                                error:
                                    "Invalid refresh token"
                            });
                    }

                    const user =
                        findUserByUid(
                            db,
                            decoded.uid
                        );

                    if (!user) {

                        return res.status(404)
                            .json({

                                success: false,

                                error:
                                    "Account haipatikani"
                            });
                    }

                    if (
                        Number(
                            decoded.tokenVersion
                        ) !==
                        Number(
                            user.tokenVersion
                        )
                    ) {

                        delete db
                            .refreshTokens[
                                hash
                            ];

                        saveDB(db);

                        return res.status(401)
                            .json({

                                success: false,

                                error:
                                    "Session ime-expire"
                            });
                    }

                    /*
                     * Refresh token rotation.
                     */

                    delete db
                        .refreshTokens[
                            hash
                        ];

                    const newRefreshToken =
                        createRefreshToken(
                            user
                        );

                    const newRefreshHash =
                        hashToken(
                            newRefreshToken
                        );

                    db.refreshTokens[
                        newRefreshHash
                    ] = {

                        uid:
                            user.uid,

                        tokenVersion:
                            user.tokenVersion,

                        createdAt:
                            now()
                    };

                    const accessToken =
                        createAccessToken(
                            user
                        );

                    saveDB(db);

                    res.json({

                        success: true,

                        uid:
                            user.uid,

                        accessToken,

                        refreshToken:
                            newRefreshToken
                    });
                }
            );

        } catch (error) {

            console.error(
                "REFRESH ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                error:
                    "Refresh failed"
            });
        }
    }
);

/* =========================================================
   AUTH - ME
========================================================= */

app.get(
    "/v1/auth/me",

    requireApiKey,

    verifyToken,

    (req, res) => {

        const db =
            readDB();

        const user =
            findUserByUid(
                db,
                req.user.uid
            );

        if (!user) {

            return res.status(404).json({

                success: false,

                error:
                    "Account haipatikani"
            });
        }

        res.json({

            success: true,

            uid:
                user.uid,

            user:
                sanitizeUser(
                    user
                )
        });
    }
);

/* =========================================================
   AUTH - UPDATE PROFILE
========================================================= */

app.patch(
    "/v1/auth/profile",

    requireApiKey,

    verifyToken,

    (req, res) => {

        const db =
            readDB();

        const user =
            findUserByUid(
                db,
                req.user.uid
            );

        if (!user) {

            return res.status(404).json({

                success: false,

                error:
                    "Account haipatikani"
            });
        }

        if (
            req.body.displayName !==
            undefined
        ) {

            user.displayName =
                String(
                    req.body.displayName
                ).trim();
        }

        if (
            req.body.photoURL !==
            undefined
        ) {

            user.photoURL =
                String(
                    req.body.photoURL
                ).trim();
        }

        user.updatedAt =
            now();

        saveDB(db);

        io.emit(
            "user.updated",
            {
                uid:
                    user.uid,

                user:
                    sanitizeUser(
                        user
                    )
            }
        );

        res.json({

            success: true,

            uid:
                user.uid,

            user:
                sanitizeUser(
                    user
                )
        });
    }
);

/* =========================================================
   AUTH - LOGOUT
========================================================= */

app.post(
    "/v1/auth/logout",

    requireApiKey,

    verifyToken,

    (req, res) => {

        try {

            const db =
                readDB();

            const user =
                findUserByUid(
                    db,
                    req.user.uid
                );

            if (!user) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Account haipatikani"
                });
            }

            /*
             * Logout inaua access tokens
             * za session hii na refresh tokens.
             */

            user.tokenVersion =
                Number(
                    user.tokenVersion || 1
                ) + 1;

            user.updatedAt =
                now();

            for (
                const [
                    tokenHash,
                    tokenData
                ]
                of Object.entries(
                    db.refreshTokens
                )
            ) {

                if (
                    tokenData.uid ===
                    user.uid
                ) {

                    delete db
                        .refreshTokens[
                            tokenHash
                        ];
                }
            }

            saveDB(db);

            res.json({

                success: true,

                message:
                    "Umetoka kwenye account"
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                error:
                    "Logout failed"
            });
        }
    }
);

/* =========================================================
   AUTH - DELETE ACCOUNT
========================================================= */

app.delete(
    "/v1/auth/account",

    requireApiKey,

    verifyToken,

    (req, res) => {

        try {

            const db =
                readDB();

            const user =
                findUserByUid(
                    db,
                    req.user.uid
                );

            if (!user) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Account haipatikani"
                });
            }

            /*
             * Optional confirmation.
             *
             * Client anaweza kutuma:
             *
             * {
             *   "password": "..."
             * }
             */

            const password =
                req.body.password;

            if (
                password !==
                undefined
            ) {

                const valid =
                    bcrypt.compareSync(
                        String(password),
                        user.password
                    );

                if (!valid) {

                    return res.status(401).json({

                        success: false,

                        error:
                            "Password si sahihi"
                    });
                }
            }

            /*
             * Futa refresh tokens.
             */

            for (
                const [
                    tokenHash,
                    tokenData
                ]
                of Object.entries(
                    db.refreshTokens
                )
            ) {

                if (
                    tokenData.uid ===
                    user.uid
                ) {

                    delete db
                        .refreshTokens[
                            tokenHash
                        ];
                }
            }

            /*
             * Futa files za user.
             */

            for (
                const [
                    fileId,
                    file
                ]
                of Object.entries(
                    db.files
                )
            ) {

                if (
                    file.uid ===
                    user.uid
                ) {

                    const filePath =
                        path.resolve(
                            STORAGE_DIR,
                            file.fileName
                        );

                    const storageRoot =
                        path.resolve(
                            STORAGE_DIR
                        );

                    if (
                        filePath.startsWith(
                            storageRoot +
                            path.sep
                        )
                    ) {

                        if (
                            fs.existsSync(
                                filePath
                            )
                        ) {

                            try {

                                fs.unlinkSync(
                                    filePath
                                );

                            } catch (_) {}
                        }
                    }

                    delete db.files[
                        fileId
                    ];
                }
            }

            /*
             * Futa user data
             */

            delete db.users[
                user.email
            ];

            /*
             * Futa database data chini
             * ya /users/{uid} ikiwa ipo.
             */

            if (
                db.data.users &&
                db.data.users[user.uid]
            ) {

                delete db.data.users[
                    user.uid
                ];
            }

            if (
                db.data.profiles &&
                db.data.profiles[user.uid]
            ) {

                delete db.data.profiles[
                    user.uid
                ];
            }

            saveDB(db);

            io.emit(
                "user.deleted",
                {
                    uid:
                        user.uid
                }
            );

            res.json({

                success: true,

                uid:
                    user.uid,

                message:
                    "Account imefutwa kabisa"
            });

        } catch (error) {

            console.error(
                "DELETE ACCOUNT ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                error:
                    "Account deletion failed"
            });
        }
    }
);

/* =========================================================
   DATABASE GET
========================================================= */

app.get(
    /^\/v1\/db\/(.+)$/,

    requireApiKey,

    verifyToken,

    (req, res) => {

        try {

            const parts =
                splitPath(
                    req.params[0]
                );

            if (!parts.length) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Database path haipo"
                });
            }

            const db =
                readDB();

            const value =
                getPathObject(
                    db.data,
                    parts
                );

            res.json({

                success: true,

                path:
                    pathToString(
                        parts
                    ),

                data:
                    value === undefined
                        ? null
                        : value
            });

        } catch (error) {

            res.status(400).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   DATABASE PUT
========================================================= */

app.put(
    /^\/v1\/db\/(.+)$/,

    requireApiKey,

    verifyToken,

    (req, res) => {

        try {

            const parts =
                splitPath(
                    req.params[0]
                );

            if (!parts.length) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Database path haipo"
                });
            }

            if (
                !isObject(
                    req.body
                )
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Data lazima iwe JSON object"
                });
            }

            const data = {
                ...req.body
            };

            /*
             * Security fields.
             */

            delete data.password;

            delete data.tokenVersion;

            data.updatedAt =
                now();

            const db =
                readDB();

            setPathObject(
                db.data,
                parts,
                data
            );

            saveDB(db);

            const fullPath =
                pathToString(
                    parts
                );

            const payload = {

                path:
                    fullPath,

                data,

                uid:
                    req.user.uid,

                timestamp:
                    now()
            };

            io.emit(
                "database.updated",
                payload
            );

            io.to(
                "path:" +
                fullPath
            ).emit(
                "value.changed",
                payload
            );

            res.json({

                success: true,

                path:
                    fullPath,

                data
            });

        } catch (error) {

            res.status(400).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   DATABASE PATCH
========================================================= */

app.patch(
    /^\/v1\/db\/(.+)$/,

    requireApiKey,

    verifyToken,

    (req, res) => {

        try {

            const parts =
                splitPath(
                    req.params[0]
                );

            if (!parts.length) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Database path haipo"
                });
            }

            if (
                !isObject(
                    req.body
                )
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Data lazima iwe JSON object"
                });
            }

            const db =
                readDB();

            let current =
                getPathObject(
                    db.data,
                    parts
                );

            if (
                !isObject(
                    current
                )
            ) {

                current = {};
            }

            const patch = {
                ...req.body
            };

            delete patch.password;

            delete patch.tokenVersion;

            Object.assign(
                current,
                patch
            );

            current.updatedAt =
                now();

            setPathObject(
                db.data,
                parts,
                current
            );

            saveDB(db);

            const fullPath =
                pathToString(
                    parts
                );

            const payload = {

                path:
                    fullPath,

                data:
                    current,

                uid:
                    req.user.uid,

                timestamp:
                    now()
            };

            io.emit(
                "database.updated",
                payload
            );

            io.to(
                "path:" +
                fullPath
            ).emit(
                "value.changed",
                payload
            );

            res.json({

                success: true,

                path:
                    fullPath,

                data:
                    current
            });

        } catch (error) {

            res.status(400).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   DATABASE POST
========================================================= */

app.post(
    /^\/v1\/db\/(.+)$/,

    requireApiKey,

    verifyToken,

    (req, res) => {

        try {

            const parts =
                splitPath(
                    req.params[0]
                );

            if (!parts.length) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Database path haipo"
                });
            }

            if (
                !isObject(
                    req.body
                )
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Data lazima iwe JSON object"
                });
            }

            const db =
                readDB();

            const id =
                req.body.id ||
                generateId(
                    "record"
                );

            const record = {

                ...req.body,

                id,

                createdAt:
                    now(),

                updatedAt:
                    now()
            };

            delete record.password;

            delete record.tokenVersion;

            let collection =
                getPathObject(
                    db.data,
                    parts
                );

            if (
                !isObject(
                    collection
                )
            ) {

                collection = {};

                setPathObject(
                    db.data,
                    parts,
                    collection
                );
            }

            collection[id] =
                record;

            saveDB(db);

            const fullPath =
                pathToString(
                    parts
                ) +
                "/" +
                id;

            const payload = {

                path:
                    fullPath,

                data:
                    record,

                uid:
                    req.user.uid,

                timestamp:
                    now()
            };

            io.emit(
                "database.created",
                payload
            );

            io.to(
                "path:" +
                fullPath
            ).emit(
                "value.created",
                payload
            );

            res.status(201).json({

                success: true,

                id,

                path:
                    fullPath,

                data:
                    record
            });

        } catch (error) {

            res.status(400).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   DATABASE DELETE
========================================================= */

app.delete(
    /^\/v1\/db\/(.+)$/,

    requireApiKey,

    verifyToken,

    (req, res) => {

        try {

            const parts =
                splitPath(
                    req.params[0]
                );

            if (!parts.length) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Database path haipo"
                });
            }

            const db =
                readDB();

            const deleted =
                deletePathObject(
                    db.data,
                    parts
                );

            if (!deleted) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Data haikupatikana"
                });
            }

            saveDB(db);

            const fullPath =
                pathToString(
                    parts
                );

            const payload = {

                path:
                    fullPath,

                uid:
                    req.user.uid,

                timestamp:
                    now()
            };

            io.emit(
                "database.deleted",
                payload
            );

            io.to(
                "path:" +
                fullPath
            ).emit(
                "value.deleted",
                payload
            );

            res.json({

                success: true,

                path:
                    fullPath,

                message:
                    "Data imefutwa"
            });

        } catch (error) {

            res.status(400).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   STORAGE CONFIG
========================================================= */

const storage =
    multer.diskStorage({

        destination:
            (req, file, cb) => {

                cb(
                    null,
                    STORAGE_DIR
                );
            },

        filename:
            (req, file, cb) => {

                const extension =
                    path.extname(
                        file.originalname
                    )
                    .toLowerCase();

                const filename =
                    crypto.randomUUID() +
                    extension;

                cb(
                    null,
                    filename
                );
            }
    });

/* =========================================================
   ALLOWED FILE TYPES
========================================================= */

const ALLOWED_MIME_TYPES = [

    /* Images */

    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",

    /* Videos */

    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",

    /* Audio */

    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/ogg",
    "audio/webm",

    /* Documents */

    "application/pdf",

    "text/plain",

    "application/zip",

    "application/x-zip-compressed",

    /* Office */

    "application/msword",

    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    "application/vnd.ms-excel",

    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    "application/vnd.ms-powerpoint",

    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
];

/* =========================================================
   MULTER
========================================================= */

const upload =
    multer({

        storage,

        limits: {

            fileSize:
                MAX_FILE_SIZE
        },

        fileFilter:
            (req, file, cb) => {

                if (
                    ALLOWED_MIME_TYPES
                        .includes(
                            file.mimetype
                        )
                ) {

                    cb(
                        null,
                        true
                    );

                } else {

                    cb(
                        new Error(
                            "Aina ya file hairuhusiwi"
                        )
                    );
                }
            }
    });

/* =========================================================
   STORAGE UPLOAD
========================================================= */

app.post(
    "/v1/storage/upload",

    requireApiKey,

    verifyToken,

    upload.single("file"),

    (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Faili halijatumwa"
                });
            }

            const db =
                readDB();

            const fileId =
                generateId(
                    "file"
                );

            const fileData = {

                id:
                    fileId,

                uid:
                    req.user.uid,

                originalName:
                    req.file.originalname,

                fileName:
                    req.file.filename,

                mimeType:
                    req.file.mimetype,

                size:
                    req.file.size,

                createdAt:
                    now()
            };

            /*
             * PUBLIC FILE URL
             *
             * Hii URL inaweza kufunguka
             * moja kwa moja kwenye browser.
             */

            const baseUrl =
                process.env.PUBLIC_URL ||
                `${req.protocol}://${req.get("host")}`;

            fileData.url =
                baseUrl +
                "/v1/storage/public/" +
                fileId;

            db.files[
                fileId
            ] = fileData;

            saveDB(db);

            io.emit(
                "storage.created",
                {
                    file:
                        fileData
                }
            );

            res.status(201).json({

                success: true,

                file:
                    fileData,

                message:
                    "File limeuploadiwa"
            });

        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );

            if (
                req.file
            ) {

                const filePath =
                    path.join(
                        STORAGE_DIR,
                        req.file.filename
                    );

                if (
                    fs.existsSync(
                        filePath
                    )
                ) {

                    try {

                        fs.unlinkSync(
                            filePath
                        );

                    } catch (_) {}
                }
            }

            res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   PUBLIC STORAGE FILE
========================================================= */

/*
 * MUHIMU:
 *
 * Endpoint hii HAINA:
 *
 * requireApiKey
 * verifyToken
 *
 * kwa sababu link ya file inatakiwa
 * ifunguke kwenye browser yoyote.
 *
 * Mfano:
 *
 * https://domain.com/v1/storage/public/file_xxx
 */

app.get(
    "/v1/storage/public/:id",
    (req, res) => {

        try {

            const db =
                readDB();

            const file =
                db.files[
                    req.params.id
                ];

            if (!file) {

                return res.status(404).send(
                    "File haipatikani"
                );
            }

            const filePath =
                path.resolve(
                    STORAGE_DIR,
                    file.fileName
                );

            const storageRoot =
                path.resolve(
                    STORAGE_DIR
                );

            /*
             * Path traversal protection.
             */

            if (
                !filePath.startsWith(
                    storageRoot +
                    path.sep
                )
            ) {

                return res.status(403).send(
                    "Invalid storage path"
                );
            }

            if (
                !fs.existsSync(
                    filePath
                )
            ) {

                return res.status(404).send(
                    "File haipo kwenye storage"
                );
            }

            /*
             * Browser inajua aina ya file.
             */

            res.setHeader(
                "Content-Type",
                file.mimeType
            );

            /*
             * inline =
             * image/video/pdf inaweza
             * ku-display browser.
             */

            res.setHeader(
                "Content-Disposition",
                "inline; filename=\"" +
                String(
                    file.originalName
                ).replace(
                    /["\r\n]/g,
                    "_"
                ) +
                "\""
            );

            res.setHeader(
                "Cache-Control",
                "public, max-age=3600"
            );

            /*
             * Range requests ni muhimu
             * kwa video/audio.
             */

            res.sendFile(
                filePath
            );

        } catch (error) {

            console.error(
                "PUBLIC FILE ERROR:",
                error
            );

            res.status(500).send(
                "Storage error"
            );
        }
    }
);

/* =========================================================
   STORAGE METADATA
========================================================= */

app.get(
    "/v1/storage/:id",

    requireApiKey,

    verifyToken,

    (req, res) => {

        const db =
            readDB();

        const file =
            db.files[
                req.params.id
            ];

        if (!file) {

            return res.status(404).json({

                success: false,

                error:
                    "File haipatikani"
            });
        }

        /*
         * Bila roles:
         * owner ndiye anaweza kuona
         * metadata kupitia authenticated API.
         */

        if (
            file.uid !==
            req.user.uid
        ) {

            return res.status(403).json({

                success: false,

                error:
                    "Huna ruhusa ya kuona metadata hii"
            });
        }

        res.json({

            success: true,

            file
        });
    }
);

/* =========================================================
   STORAGE DELETE
========================================================= */

app.delete(
    "/v1/storage/:id",

    requireApiKey,

    verifyToken,

    (req, res) => {

        try {

            const db =
                readDB();

            const file =
                db.files[
                    req.params.id
                ];

            if (!file) {

                return res.status(404).json({

                    success: false,

                    error:
                        "File haipatikani"
                });
            }

            /*
             * Bila roles:
             * owner pekee ndiye anaweza kufuta.
             */

            if (
                file.uid !==
                req.user.uid
            ) {

                return res.status(403).json({

                    success: false,

                    error:
                        "Huna ruhusa kufuta file hii"
                });
            }

            const filePath =
                path.resolve(
                    STORAGE_DIR,
                    file.fileName
                );

            const storageRoot =
                path.resolve(
                    STORAGE_DIR
                );

            if (
                !filePath.startsWith(
                    storageRoot +
                    path.sep
                )
            ) {

                return res.status(403).json({

                    success: false,

                    error:
                        "Invalid storage path"
                });
            }

            if (
                fs.existsSync(
                    filePath
                )
            ) {

                fs.unlinkSync(
                    filePath
                );
            }

            delete db.files[
                req.params.id
            ];

            saveDB(db);

            io.emit(
                "storage.deleted",
                {
                    id:
                        req.params.id,

                    uid:
                        req.user.uid
                }
            );

            res.json({

                success: true,

                message:
                    "File imefutwa"
            });

        } catch (error) {

            console.error(
                "STORAGE DELETE ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                error:
                    "Storage delete failed"
            });
        }
    }
);

/* =========================================================
   REALTIME SOCKET.IO AUTH
========================================================= */

io.use(
    (socket, next) => {

        try {

            const apiKey =
                socket.handshake
                    .auth
                    ?.apiKey;

            if (
                apiKey !==
                API_KEY
            ) {

                return next(
                    new Error(
                        "Invalid API key"
                    )
                );
            }

            const token =
                socket.handshake
                    .auth
                    ?.token;

            if (!token) {

                return next(
                    new Error(
                        "Token required"
                    )
                );
            }

            const decoded =
                jwt.verify(
                    token,
                    JWT_SECRET
                );

            const db =
                readDB();

            const user =
                findUserByUid(
                    db,
                    decoded.uid
                );

            if (!user) {

                return next(
                    new Error(
                        "Account not found"
                    )
                );
            }

            /*
             * Token version check.
             */

            if (
                Number(
                    decoded.tokenVersion
                ) !==
                Number(
                    user.tokenVersion
                )
            ) {

                return next(
                    new Error(
                        "Session expired"
                    )
                );
            }

            socket.user = {

                uid:
                    user.uid,

                email:
                    user.email
            };

            next();

        } catch (error) {

            next(
                new Error(
                    "Authentication failed"
                )
            );
        }
    }
);

/* =========================================================
   SOCKET.IO REALTIME
========================================================= */

io.on(
    "connection",
    (socket) => {

        console.log(
            "Realtime connected:",
            socket.user.uid
        );

        socket.emit(
            "connected",
            {

                success: true,

                uid:
                    socket.user.uid,

                timestamp:
                    now()
            }
        );

        /* =================================================
           SUBSCRIBE
        ================================================= */

        socket.on(
            "subscribe",
            (pathString) => {

                try {

                    if (
                        !pathString
                    ) {
                        return;
                    }

                    const parts =
                        splitPath(
                            pathString
                        );

                    if (
                        !parts.length
                    ) {

                        return;
                    }

                    const room =
                        "path:" +
                        pathToString(
                            parts
                        );

                    socket.join(
                        room
                    );

                    const db =
                        readDB();

                    const data =
                        getPathObject(
                            db.data,
                            parts
                        );

                    socket.emit(
                        "initial.value",
                        {

                            path:
                                pathToString(
                                    parts
                                ),

                            data:
                                data ===
                                undefined
                                    ? null
                                    : data
                        }
                    );

                } catch (error) {

                    socket.emit(
                        "error",
                        {
                            message:
                                error.message
                        }
                    );
                }
            }
        );

        /* =================================================
           UNSUBSCRIBE
        ================================================= */

        socket.on(
            "unsubscribe",
            (pathString) => {

                try {

                    if (
                        !pathString
                    ) {
                        return;
                    }

                    const parts =
                        splitPath(
                            pathString
                        );

                    socket.leave(
                        "path:" +
                        pathToString(
                            parts
                        )
                    );

                } catch (error) {

                    console.error(
                        "UNSUBSCRIBE ERROR:",
                        error
                    );
                }
            }
        );

        /* =================================================
           DISCONNECT
        ================================================= */

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "Realtime disconnected:",
                    socket.user.uid
                );
            }
        );
    }
);

/* =========================================================
   SOCKET ERROR
========================================================= */

io.engine.on(
    "connection_error",
    (error) => {

        console.error(
            "Socket connection error:",
            error.message
        );
    }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            error instanceof
            multer.MulterError
        ) {

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "File ni kubwa kuliko 500MB"
                });
            }

            return res.status(400).json({

                success: false,

                error:
                    "Upload error: " +
                    error.message
            });
        }

        if (
            error &&
            error.message ===
                "Aina ya file hairuhusiwi"
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Aina ya file hairuhusiwi"
            });
        }

        res.status(500).json({

            success: false,

            error:
                "Internal server error"
        });
    }
);

/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            error:
                "Endpoint haipatikani"
        });
    }
);

/* =========================================================
   START SERVER
========================================================= */

server.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "=========================================="
        );

        console.log(
            "              GRAMDB SERVER"
        );

        console.log(
            "=========================================="
        );

        console.log(
            "HTTP        : http://localhost:" +
            PORT
        );

        console.log(
            "Auth        : ENABLED"
        );

        console.log(
            "UID         : ENABLED"
        );

        console.log(
            "JWT         : ENABLED"
        );

        console.log(
            "Sessions     : ENABLED"
        );

        console.log(
            "Database     : ENABLED"
        );

        console.log(
            "Realtime     : ENABLED"
        );

        console.log(
            "Socket.IO    : ENABLED"
        );

        console.log(
            "Storage      : ENABLED"
        );

        console.log(
            "Public Files : ENABLED"
        );

        console.log(
            "Rate Limit   : ENABLED"
        );

        console.log(
            "Roles        : DISABLED"
        );

        console.log(
            "=========================================="
        );

        console.log(
            ""
        );
    }
);
