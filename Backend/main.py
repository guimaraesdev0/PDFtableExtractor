from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import tabula
import tempfile
import os
import json
import pandas as pd
import io

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return "API alive", 200

@app.route('/gettables', methods=['POST'])
def extract_tables():
    if 'pdf' not in request.files or 'areas' not in request.form:
        return jsonify({'error': 'Faltam parâmetros'}), 400

    pdf_file = request.files['pdf']
    areas = request.form['areas']

    try:
        areas = json.loads(areas)
    except json.JSONDecodeError:
        return jsonify({'error': 'Formato de áreas inválido'}), 400

    results = []

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_pdf:
        pdf_file.save(tmp_pdf.name)
        tmp_pdf_path = tmp_pdf.name

    try:
        for area in sorted(areas, key=lambda x: (x['pageNum'], x['top'])):
            page_num = area['pageNum']
            bbox = [area['top'], area['left'], area['bottom'], area['right']]
            dfs = tabula.read_pdf(tmp_pdf_path, pages=page_num, area=bbox, stream=True)

            if dfs:
                for df in dfs:
                    df = df.replace({pd.NA: None})

                    if not df.empty:
                        # Remover linhas invisíveis (em branco ou NaN)
                        df.dropna(how='all', inplace=True)

                        # Remover espaços extras dentro dos itens
                        df = df.applymap(lambda x: str(x).strip() if x is not None else x)

                        columns_order = list(df.columns)
                        columns_order = sorted(columns_order, key=lambda x: columns_order.index(x))
                        df = df[columns_order]

                    results.append({
                        'page': page_num,
                        'table': df
                    })
    finally:
        os.remove(tmp_pdf_path)

    # Gerar CSV
    csv_buffer = io.StringIO()
    
    for i, result in enumerate(results):
        df = result['table']
        df_csv = df.to_csv(index=False, header=True)
        csv_buffer.write(df_csv.replace('\n', '').strip())
        
        if i < len(results) - 1:
            csv_buffer.write('\n\n')

    csv_buffer.seek(0)
    csv_filename = "tabelas.csv"

    csv_path = tempfile.mktemp(suffix=".csv")
    with open(csv_path, 'w') as f:
        f.write(csv_buffer.getvalue().strip())  # Remover espaços extras no final

    return send_file(csv_path, as_attachment=True, download_name=csv_filename)

if __name__ == '__main__':
    app.run(debug=False)
