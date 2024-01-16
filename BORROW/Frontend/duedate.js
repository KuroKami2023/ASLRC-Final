const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const Swal = require('sweetalert2');

const dbPath = path.join(__dirname, '../Backend/Borrow/books.db');
const userDBPath = ('\\\\DESKTOP-0ACG64R\\Backend\\users.db');

const db = new sqlite3.Database(dbPath);
const userDB = new sqlite3.Database(userDBPath);
let bid = "";

const userQ = "SELECT * FROM user";
userDB.all(userQ, [], (err, rows) => { 
    if(err) {
        showError("Error fetching borrow data: " + err.message);
        return;
    } const promises = rows.map((row) => {
        return new Promise((resolve, reject) => {
            console.log(row.Name);
        });
    });
})

window.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('userTable');
    table.innerHTML = '';

    const borrowSqlQuery = `
        SELECT 
            borrow.*, 
            accnum.accNum, 
            books.bookTitle,
            return.overDueFine 
        FROM 
            borrow 
        INNER JOIN 
            accnum ON borrow.bookID = accnum.accNum 
        INNER JOIN 
            books ON accnum.bookNumber = books.bookNumber
        LEFT JOIN
            return ON borrow.borrowID = return.borrowID
        WHERE 
            borrow.dueDate <> 'None' 
            AND return.overDueFine IS NOT NULL;
    `;

    db.all(borrowSqlQuery, [], (err, rows) => {
        if (err) {
            showError("Error fetching borrow data: " + err.message);
            return;
        }

        const promises = rows.map((row) => {
            return new Promise((resolve, reject) => {
                userDB.get('SELECT Name, IDNumber FROM user WHERE UserID = ?', [row.borrowerID], (err, userRow) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            borrowID: row.borrowID,
                            Name: userRow ? userRow.Name : 'N/A', 
                            IDNumber: userRow ? userRow.IDNumber : 'N/A',
                            accNum: row.accNum,
                            bookTitle: row.bookTitle,
                            dueDate: row.dueDate
                        });
                    }
                });
            });
        });

        Promise.all(promises)
        .then((resultRows) => {
            const currentDate = new Date();
    
            resultRows.forEach((row) => {
                const dueDate = new Date(row.dueDate);
                const hoursLate = Math.max(0, (currentDate - dueDate) / (60 * 60 * 1000));
                if (row.dueDate !== "None" && hoursLate > 0) {
                    const overdueFine = hoursLate * 2;
    
                    const updateQuery = `UPDATE return SET overDueFine = ? WHERE borrowID = ?`;
                    const updateParams = [overdueFine.toFixed(1), row.borrowID];
    
                    db.run(updateQuery, updateParams, (err) => {
                        if (err) {
                            showError("Error updating overDueFine: " + err.message);
                            return;
                        }
                    });
                }
    
                let tr = document.createElement('tr');
                tr.style.height = '40px';
                tr.innerHTML = `<td>${row.borrowID}</td>
                                <td>${row.Name}</td>
                                <td>${row.IDNumber}</td>
                                <td>${row.accNum}</td>
                                <td>${row.bookTitle}</td>
                                <td>${row.dueDate}</td>`;
    
                if (hoursLate > 0) {
                    tr.style.backgroundColor = 'red';
                    const overdueFine = hoursLate * 2;
                    tr.innerHTML += `<td>₱ ${overdueFine.toFixed(2)}</td>`;
                } else {
                    tr.innerHTML += `<td>₱ 0</td>`;
                }
                tr.innerHTML += '<td><button type="button" class="btn btn-outline-success" style="height: 35px" onclick="payFine(' + row.borrowID + ')">Paid</button></td>';
    
                table.appendChild(tr);
            });
        })
        .catch((error) => {
            showError("Error fetching user data: " + error.message);
        });
    });
});


const tableBody = document.getElementById('userTable');
const searchBook = document.getElementById('search-book');
searchBook.addEventListener('input', function () {
    const searchTerm = searchBook.value.trim().toLowerCase();

    const tableRows = tableBody.querySelectorAll('tr');

    tableRows.forEach(row => {
        const idNumberCell = row.querySelector('td:nth-child(3)');
        const nameCell = row.querySelector('td:nth-child(2)');
        const accNumCell = row.querySelector('td:nth-child(4)');

        if (nameCell && idNumberCell && accNumCell) {
            const name = nameCell.textContent.toLowerCase();
            const idNumber = idNumberCell.textContent.toLowerCase();
            const accNum = accNumCell.textContent.toLowerCase();
        
            if (name.includes(searchTerm) || idNumber.includes(searchTerm) || accNum.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
        
        
    });
});

function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message,
    });
}

function showSuccess(message) {
    Swal.fire({
        icon: 'success',
        title: 'Success',
        text: message,
    }).then(() => {
        window.location.reload();
    });
}

function confirmPayment(borrowID) {
    Swal.fire({
        title: 'Confirm Payment',
        text: 'Are you sure you want to mark this as paid?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, mark as paid'
    }).then((result) => {
        if (result.isConfirmed) {
            payFine(borrowID);
        }
    });
}

function payFine(borrowID) {
    let overdueFine = 0;

    userDB.get('SELECT Name, IDNumber FROM user WHERE UserID = ?', [bid], (err, userRow) => {
        if (err) {
            showError("Error fetching user data: " + err.message);
        } else {
            db.get('SELECT accnum.accNum, books.bookTitle, return.overDueFine FROM borrow ' +
                'INNER JOIN accnum ON borrow.bookID = accnum.accNum ' +
                'INNER JOIN books ON accnum.bookNumber = books.bookNumber ' +
                'LEFT JOIN return ON borrow.borrowID = return.borrowID ' +
                'WHERE borrow.borrowID = ? AND return.overDueFine IS NOT NULL', [borrowID], (err, row) => {
                    if (err) {
                        showError("Error fetching book data: " + err.message);
                    } else {
                        overdueFine = row && !isNaN(row.overDueFine) ? parseFloat(row.overDueFine) : 0;

                        const receiptNumber = generateReceiptNumber();
                        const bookTitle = row && row.bookTitle ? row.bookTitle : 'N/A';
                        const accNum = row && row.accNum ? row.accNum : 'N/A';

                        const receiptContent = `
                            <h1>Official Receipt</h1>
                            <p>Receipt Number: ${receiptNumber}</p>
                            <p>Borrow ID: ${borrowID}</p>
                            <p>Borrower Name: ${userRow ? userRow.Name : 'N/A'}</p>
                            <p>ID Number: ${userRow ? userRow.IDNumber : 'N/A'}</p>
                            <p>Book Title: ${bookTitle}</p>
                            <p>Accession Number: ${accNum}</p>
                            <p>Overdue Fine Total: ₱ ${overdueFine.toFixed(2)}</p>
                        `;

                        const receiptWindow = window.open('', '_blank');
                        receiptWindow.document.write(`
                            <html>
                                <head>
                                    <title>Official Receipt</title>
                                </head>
                                <body>
                                    ${receiptContent}
                                </body>
                            </html>
                        `);

                        window.onbeforeunload = function () {
                            showSuccess("Print canceled. Payment successful. Receipt generated.");
                        };

                        receiptWindow.document.close();
                        receiptWindow.print();
                        window.onbeforeunload = null;
                    }
                });
        }
    });
}

function generateReceiptNumber() {
    const timestamp = new Date().getTime();
    return `OR-${timestamp}`;
}
