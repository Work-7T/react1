const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool1 = new Pool({
    user: "postgres",
    host: "localhost",
    database: "All_NN",
    password: "1234",
    port: 5432,
});


app.get("/api/summary/roads", async (req, res) => {
    const {
        zone,
        ward,
        ownership,
        category,
        condition,
        material,
        rowcls,
        drain_type,
        length_min,
        length_max
    } = req.query;

    try {
        let where = [];
        let params = [];

        if (zone) {
            params.push(zone);
            where.push(`zone_no = $${params.length}`);
        }

        if (ward) {
            params.push(ward);
            where.push(`
            EXISTS (SELECT 1 FROM unnest(string_to_array(ward_no, ',')) w WHERE trim(w)::int = $${params.length})`);
        }

        /* -------- LENGTH RANGE FILTER -------- */

        if (length_min) {
            params.push(parseFloat(length_min));
            where.push(`length_km >= $${params.length}`);
        }

        if (length_max) {
            params.push(parseFloat(length_max));
            where.push(`length_km <= $${params.length}`);
        }

        /* -------- SCAN FILTERS -------- */

        const scanFilters = {
            ownership,
            category,
            condition,
            material,
            rowcls,
            drain_type
        };

        Object.entries(scanFilters).forEach(([key, value]) => {

            if (!value) return;

            const vals = value.split(",");

            const placeholders = vals.map((_, i) =>
                `$${params.length + i + 1}`
            );

            where.push(`${key} IN (${placeholders.join(",")})`);

            params.push(...vals);

        });
        const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const q = `
        SELECT COUNT(DISTINCT road_id)::int AS total_roads, COALESCE(SUM(length_km), 0)::float AS total_length_km FROM kanpur_nn.kanpur_road_net
        ${whereClause}`;

        const r = await pool1.query(q, params);
        res.json(r.rows[0]);

    } catch (err) {
        console.error("SUMMARY ERROR:", err);
        res.status(500).json({ error: "Server error" });
    }
});


// app.get("/api/summary/group", async (req, res) => {
//     const { field, zone, ward, ownership, category, condition, material, rowcls, drain_type } = req.query;

//     const allowedFields = [
//         "ownership",
//         "category",
//         "condition",
//         "material",
//         "rowcls",
//         "drain_type"
//     ];



//     if (!allowedFields.includes(field)) {
//         return res.status(400).json({ error: "Invalid field" });
//     }

//     try {
//         let where = [];
//         let params = [];

//         if (zone) {
//             params.push(zone);
//             where.push(`zone_no = $${params.length}`);
//         }

//         if (ward) {
//             params.push(ward);
//             where.push(`
//         EXISTS (SELECT 1 FROM unnest(string_to_array(ward_no, ',')) w WHERE trim(w)::int = $${params.length})`);
//         }

//         const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

//         const q = `SELECT COALESCE(${field}, 'Unknown') AS name, COUNT(*)::int AS count FROM kanpur_nn.kanpur_road_net ${whereClause} GROUP BY ${field} ORDER BY count DESC`;

//         const r = await pool1.query(q, params);
//         res.json(r.rows);

//     } catch (err) {
//         console.error("GROUP ERROR:", err);
//         res.status(500).json({ error: "Server error" });
//     }
// });
app.get("/api/summary/group", async (req, res) => {

    const { field, zone, ward, ...filters } = req.query;

    const allowedFields = [
        "ownership",
        "category",
        "condition",
        "material",
        "rowcls",
        "drain_type"
    ];

    if (!allowedFields.includes(field)) {
        return res.status(400).json({ error: "Invalid field" });
    }

    try {

        let where = [];
        let params = [];

        /* ZONE FILTER */
        if (zone) {
            params.push(zone);
            where.push(`zone_no = $${params.length}`);
        }

        /* WARD FILTER (comma stored values) */
        if (ward) {
            params.push(ward);
            where.push(`
        EXISTS (
            SELECT 1
            FROM unnest(string_to_array(ward_no, ',')) w
            WHERE trim(w)::int = ANY(string_to_array($${params.length}, ',')::int[])
        )
    `);
        }

        /* AUTOMATIC FILTER HANDLING */
        Object.entries(filters).forEach(([column, value]) => {

            if (!allowedFields.includes(column)) return;

            params.push(value.split(","));

            where.push(`${column} = ANY($${params.length})`);

        });

        const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const q = `
SELECT
    COALESCE(${field}, 'Unknown') AS name,
    COUNT(DISTINCT road_id)::int AS count
FROM kanpur_nn.kanpur_road_net
${whereClause}
GROUP BY ${field}
ORDER BY count DESC
`;

        const result = await pool1.query(q, params);

        res.json(result.rows);

    } catch (err) {

        console.error("GROUP ERROR:", err);
        res.status(500).json({ error: "Server error" });

    }

});
app.get("/api/filters/zones", async (req, res) => {
    const q = `
        SELECT DISTINCT zone_no
        FROM kanpur_nn.kanpur_road_net
        WHERE zone_no IS NOT NULL
        ORDER BY zone_no
    `;
    const r = await pool1.query(q);
    res.json(r.rows);
});
app.get("/api/filters/wards", async (req, res) => {
    const { zone } = req.query;

    try {
        let query = `
        SELECT DISTINCT ward
        FROM (
            SELECT
            trim(unnest(string_to_array(ward_no, ',')))::int AS ward,
            zone_no
        FROM kanpur_nn.kanpur_road_net
        WHERE ward_no IS NOT NULL
        ) t
    `;

        const params = [];

        if (zone) {
            query += ` WHERE zone_no = $1`;
            params.push(zone);
        }

        query += ` ORDER BY ward`;

        const result = await pool1.query(query, params);

        res.json(
            result.rows.map(r => ({ ward_no: r.ward }))
        );

    } catch (err) {
        console.error("WARD FETCH ERROR:", err);
        res.status(500).json({ error: "Server error" });
    }
});


// app.post("/api/amenities-count", async (req, res) => {
//     try {
//         const { tables } = req.body;

//         if (!Array.isArray(tables) || tables.length === 0) {
//             return res.status(400).json({ error: "No tables provided" });
//         }

//         const results = await Promise.all(
//             tables.map(async (table) => {

//                 // Basic validation (important for SQL injection safety)
//                 if (!/^[a-zA-Z0-9_]+$/.test(table)) {
//                     throw new Error("Invalid table name");
//                 }

//                 const countResult = await pool1.query(
//                     `SELECT COUNT(*) FROM kanpur_nn.${table}`
//                 );

//                 return {
//                     name: table,
//                     count: parseInt(countResult.rows[0].count)
//                 };
//             })
//         );

//         res.json(results);

//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: "Failed to fetch counts" });
//     }
// });
app.post("/api/amenities-count", async (req, res) => {
    try {
        const { tables, zone, ward } = req.body;

        if (!Array.isArray(tables) || tables.length === 0) {
            return res.status(400).json({ error: "No tables provided" });
        }

        let where = [];
        let params = [];

        if (zone) {
            params.push(zone);
            where.push(`zone_no = $${params.length}`);
        }

        if (ward) {
            params.push(ward);
            where.push(`ward_no = $${params.length}`);
        }

        const whereClause = where.length
            ? `WHERE ${where.join(" AND ")}`
            : "";

        const results = await Promise.all(
            tables.map(async (table) => {

                if (!/^[a-zA-Z0-9_]+$/.test(table)) {
                    throw new Error("Invalid table name");
                }

                const query = `
                    SELECT COUNT(*)
                    FROM kanpur_nn.${table}
                    ${whereClause}
                `;

                const countResult = await pool1.query(query, params);

                return {
                    name: table,
                    count: parseInt(countResult.rows[0].count)
                };
            })
        );

        res.json(results);

    } catch (err) {
        console.error("AMENITIES ERROR:", err);
        res.status(500).json({ error: "Failed to fetch counts" });
    }
});

app.get("/api/filters/distinct", async (req, res) => {
    const { field } = req.query;

    const allowedFields = [
        "ownership",
        "category",
        "condition",
        "material",
        "rowcls",
        "drain_type"
    ];

    if (!allowedFields.includes(field)) {
        return res.status(400).json({ error: "Invalid field" });
    }

    try {

        const q = `
        SELECT DISTINCT ${field} AS value
        FROM kanpur_nn.kanpur_road_net
        WHERE ${field} IS NOT NULL
        ORDER BY ${field}
        `;

        const r = await pool1.query(q);

        res.json(r.rows.map(v => v.value));

    } catch (err) {
        console.error("DISTINCT ERROR", err);
        res.status(500).json({ error: "Server error" });
    }
});

app.get("/api/roads/search", async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim() === "") {
            return res.json([]);
        }

        const result = await pool1.query(
            `
        SELECT
            road_name,
            ward_no,
            zone_no,
            ST_AsGeoJSON(geom) AS geom
        FROM kanpur_nn.kanpur_road_net
        WHERE road_name ILIKE $1
        LIMIT 20
        `,
            [`%${q}%`]
        );

        const data = result.rows.map(row => ({
            road_name: row.road_name,
            ward_no: row.ward_no,
            zone_no: row.zone_no,
            geom: JSON.parse(row.geom)
        }));

        res.json(data);

    } catch (err) {
        console.error("Search API error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
