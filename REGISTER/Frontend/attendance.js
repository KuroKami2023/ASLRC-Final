const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

document.addEventListener("DOMContentLoaded", function () {
    const dbAttendance = new sqlite3.Database('\\\\DESKTOP-0ACG64R\\Record\\attendance.db');
    const dbUser = new sqlite3.Database('\\\\DESKTOP-0ACG64R\\Backend\\users.db');    
    const selectDate = document.querySelector('.form-select');
    const userTable = document.getElementById('userTable');

    selectDate.addEventListener('change', function () {
        const selectedTable = this.value;
        if (selectedTable !== 'Select Date') {
            displayAttendanceData(dbAttendance, dbUser, selectedTable);
        } else {
            userTable.innerHTML = '';
        }
    });

    fetchAttendanceTableNames(dbAttendance, selectDate);
});

function openDatabase(dbPath) {
    const db = new sqlite3.Database(dbPath);
    return db;
}

function fetchAttendanceTableNames(dbAttendance, selectDate) {
    dbAttendance.all("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name DESC;", [], function (err, results) {
        if (err) {
            console.error("Error fetching table names:", err.message);
            return;
        }
        selectDate.innerHTML = '<option selected>Select Date</option>';

        for (let i = 0; i < results.length; i++) {
            const tableName = results[i].name;
            const option = document.createElement('option');
            option.value = tableName;
            option.text = formatTableName(tableName);
            selectDate.add(option);
        }
    });
}

function formatTableName(tableName) {
    return tableName.replace('_', ': ').replace(/_/g, '-');
}

function displayAttendanceData(dbAttendance, dbUser, tableName) {
    const attendanceQuery = `SELECT * FROM ${tableName}`;
    const userQuery = `SELECT Name, IDNumber, Program, Year FROM user WHERE UserID = ?`;

    dbAttendance.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?;`, [tableName], function (tableErr, tableResult) {
        if (tableErr) {
            console.error("Error checking table existence:", tableErr.message);
            return;
        }

        if (!tableResult) {
            console.error(`Table ${tableName} does not exist in the attendance database.`);
            return;
        }

        dbAttendance.all(attendanceQuery, [], function (err, results) {
            if (err) {
                console.error("Error executing attendance query:", err.message);
                return;
            }

            const userTable = document.getElementById('userTable');
            userTable.innerHTML = '';

            for (const row of results) {
                dbUser.get(userQuery, [row.UserID], function (userErr, userRow) {
                    if (userErr) {
                        console.error("Error executing user query:", userErr.message);
                        return;
                    }

                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${userRow ? userRow.Name || '' : ''}</td>
                                    <td>${userRow ? userRow.IDNumber || '' : ''}</td>
                                    <td>${userRow ? userRow.Program || '' : ''}</td>
                                    <td>${userRow ? userRow.Year || '' : ''}</td>
                                    <td>${row.time_in || ''}</td>
                                    <td>${row.time_out || ''}</td>`;

                    userTable.appendChild(tr);
                });
            }
        });
    });
}