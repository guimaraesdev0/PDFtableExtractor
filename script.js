document.getElementById('file-input').addEventListener('change', handleFileSelect);

let pdfDoc = null;
let scale = 1.5;
let selectedAreas = [];

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file.type !== 'application/pdf') {
        alert('Please select a PDF file.');
        return;
    }
    
    const fileReader = new FileReader();
    fileReader.onload = function() {
        const typedArray = new Uint8Array(this.result);
        renderPDF(typedArray);
    };
    fileReader.readAsArrayBuffer(file);
}

async function renderPDF(data) {
    pdfDoc = await pdfjsLib.getDocument({data}).promise;
    const container = document.getElementById('pdf-container');
    container.innerHTML = '';
    selectedAreas = [];
    updateSelectedAreasList();

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({scale});
        
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const context = canvas.getContext('2d');
        await page.render({canvasContext: context, viewport: viewport}).promise;
        
        const canvasContainer = document.createElement('div');
        canvasContainer.classList.add('canvas-container');
        canvasContainer.appendChild(canvas);
        
        container.appendChild(canvasContainer);

        makeSelectable(canvasContainer, pageNum);
    }
}

function makeSelectable(container, pageNum) {
    let isSelecting = false;
    let startX, startY, selection;

    container.addEventListener('mousedown', (event) => {
        isSelecting = true;
        startX = event.offsetX;
        startY = event.offsetY;
        
        selection = document.createElement('div');
        selection.classList.add('selection');
        selection.style.left = startX + 'px';
        selection.style.top = startY + 'px';
        container.appendChild(selection);
    });

    container.addEventListener('mousemove', (event) => {
        if (!isSelecting) return;
        
        const x = event.offsetX;
        const y = event.offsetY;
        
        const width = x - startX;
        const height = y - startY;
        
        selection.style.width = Math.abs(width) + 'px';
        selection.style.height = Math.abs(height) + 'px';
        selection.style.left = (width < 0 ? x : startX) + 'px';
        selection.style.top = (height < 0 ? y : startY) + 'px';
    });

    container.addEventListener('mouseup', (event) => {
        isSelecting = false;
        
        const x = parseInt(selection.style.left.replace('px', ''));
        const y = parseInt(selection.style.top.replace('px', ''));
        const width = parseInt(selection.style.width.replace('px', ''));
        const height = parseInt(selection.style.height.replace('px', ''));

        const area = {
            pageNum,
            x,
            y,
            width,
            height
        };

        selectedAreas.push(area);
        updateSelectedAreasList();
    });
}

function updateSelectedAreasList() {
    const list = document.getElementById('selected-areas-list');
    list.innerHTML = '';
    
    selectedAreas.forEach((area, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            Page: ${area.pageNum}, X: ${area.x}, Y: ${area.y}, Width: ${area.width}, Height: ${area.height}
            <button class="delete-btn" data-index="${index}">Delete</button>
        `;
        list.appendChild(listItem);
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const index = event.target.getAttribute('data-index');
            selectedAreas.splice(index, 1);
            updateSelectedAreasList();
        });
    });
}

document.getElementById('submit-btn').addEventListener('click', () => {
    const data = {
        file: document.getElementById('file-input').files[0],
        selectedAreas
    };

    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('selectedAreas', JSON.stringify(data.selectedAreas));

    fetch('/api/upload', {
        method: 'POST',
        body: formData
    }).then(response => response.json())
      .then(result => {
          console.log('Success:', result);
      }).catch(error => {
          console.error('Error:', error);
      });
});
