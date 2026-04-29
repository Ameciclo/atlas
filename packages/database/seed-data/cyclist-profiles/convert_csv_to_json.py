#!/usr/bin/env python3
import csv
import json
from datetime import datetime

def convert_csv_to_json(csv_file_path, output_file_path):
    """Converte CSV da pesquisa perfil para formato JSON do data.json"""
    
    # Mapeamento de valores para padronização
    gender_map = {
        'Masculino': 'Masculino',
        'Feminino': 'Feminino'
    }
    
    schooling_map = {
        'Ensino Fundamental': 'Ensino Fundamental (primário e ginásio, até a oitava série)',
        'Ensino Médio': 'Ensino Médio (Segundo Grau)',
        'Ensino Superior': 'Ensino Superior (Faculdade)',
        'Pós-Graduação': 'Pós-Graduação',
        'Sem resposta': 'Sem instrução (nunca frequentou a escola ou primeira fase do ensino fundamental incompleto)'
    }
    
    renda_map = {
        'até 1 salário mínimo': 'até 1 Salário Mínimo',
        'de 1 a 2 salários mínimos': 'de 1 a 2 Salários Mínimos',
        'de 2 a 5 salários mínimos': 'de 2 a 5 Salários Mínimos',
        'acima de 5 salários mínimos': 'acima de 5 Salários Mínimos',
        'Não sabe/Não respondeu': 'até 1 Salário Mínimo'
    }
    
    tempo_map = {
        'Menos de 6 meses': 'menos de 6 meses',
        'Entre 6 meses e 1 ano': 'entre 6 meses e 1 ano',
        'Entre 1 e 2 anos': 'entre 1 e 2 anos',
        'Entre 2 e 5 anos': 'entre 2 e 5 anos',
        'Mais de 5 anos': 'mais de 5 anos'
    }
    
    bike_map = {
        'Privada': 'Privada',
        'Pública': 'Pública'
    }
    
    area_map = {
        'Área 1 - Área Central': 'Área 1 - Área Central',
        'Área 2 - Área Intermediária': 'Área 2 - Área Intermediária', 
        'Área 3 - Área Periférica': 'Área 3 - Área Periférica'
    }
    
    def get_wage_value(renda_2024):
        """Converte faixa de renda para valor numérico aproximado"""
        if not renda_2024 or renda_2024 == 'Não sabe/Não respondeu':
            return 0
        elif 'até 1' in renda_2024:
            return 1400
        elif 'de 1 a 2' in renda_2024:
            return 2000
        elif 'de 2 a 5' in renda_2024:
            return 3500
        else:
            return 7000
    
    def parse_coordinates(lat, lon):
        """Converte coordenadas string para float"""
        try:
            if lat and lon:
                lat_float = float(str(lat).replace(',', '.').replace('"', ''))
                lon_float = float(str(lon).replace(',', '.').replace('"', ''))
                return [lat_float, lon_float]
        except:
            pass
        return [-8.0, -34.9]
    
    def get_transport_combination(combina, meio):
        """Determina combinação de transporte"""
        if combina == 'Sim' and meio:
            return {"yes_no": True, "transportation": meio}
        return {"yes_no": False, "transportation": ""}
    
    results = []
    
    with open(csv_file_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        
        for idx, row in enumerate(reader, 1):
            # Pula linhas com dados essenciais faltando
            if not row.get('Idade') or not row.get('Genero'):
                continue
                
            # Dados principais
            data = {
                "age": int(row['Idade']) if row['Idade'].isdigit() else 25,
                "job": row.get('Ocupacao', 'Não informado'),
                "gender": gender_map.get(row.get('Genero'), 'Masculino'),
                "schooling": schooling_map.get(row.get('Escolaridade'), 'Ensino Médio (Segundo Grau)'),
                "collisions": "Sim" if row.get('Ocorrencia') == 'Sim' else "Não",
                "color_race": row.get('Raca', 'Parda'),
                "days_usage": {
                    "total": int(row.get('Qt_Dia', 5)) if row.get('Qt_Dia', '').isdigit() else 5,
                    "school": int(row.get('Escola', 0)) if row.get('Escola', '').isdigit() else 0,
                    "leisure": int(row.get('Lazer', 0)) if row.get('Lazer', '').isdigit() else 0,
                    "working": int(row.get('Trabalho', 5)) if row.get('Trabalho', '').isdigit() else 5,
                    "shopping": int(row.get('Compras', 0)) if row.get('Compras', '').isdigit() else 0
                },
                "years_using": tempo_map.get(row.get('Qt_Tempo_2024'), 'entre 1 e 2 anos'),
                "age_standard": renda_map.get(row.get('Renda_2024'), 'de 1 a 2 Salários Mínimos'),
                "biggest_need": row.get('Ql_Motivo', 'Mais segurança/educação no trânsito'),
                "biggest_issue": row.get('Ql_Problemas', 'Falta de segurança no trânsito'),
                "distance_time": int(row.get('Tempo', 15)) if row.get('Tempo', '').isdigit() else 15,
                "wage_standard": get_wage_value(row.get('Renda_2024')),
                "motivation_to_start": row.get('Ql_Motivo_Inicio', 'É mais rápido e prático'),
                "neighborhood_living": row.get('Bairro_Residencia', row.get('Bairro', 'Recife')),
                "neighborhood_origin": row.get('Bairro_Origem', row.get('Bairro', 'Recife')),
                "neighborhood_destiny": row.get('Bairro_Destino', row.get('Bairro', 'Recife')),
                "transport_combination": get_transport_combination(row.get('Combina'), row.get('Ou_Meio')),
                "motivation_to_continue": row.get('Ql_Motivo', 'É mais rápido e prático'),
                # Campos adicionais do CSV
                "age_category": row.get('Idade_Cat', ''),
                "income_original": row.get('Renda', ''),
                "household_quantity": int(row.get('Qt_Domicilio', 0)) if row.get('Qt_Domicilio', '').isdigit() else 0,
                "covid19_impact": row.get('Covid19', ''),
                "time_category": row.get('Tempo_Cat', ''),
                "time_original": row.get('Qt_Tempo', ''),
                "theft_occurrence": row.get('Ocorrencia_Furto', ''),
                "harassment_occurrence": row.get('Ocorrencia_Assedio', ''),
                "season": row.get('Estacao', ''),
                "combination_quality": row.get('Ql_Combina', ''),
                "transport_quality": row.get('Ql_Meio', ''),
                "system": row.get('Sistema', ''),
                "pandemic_impact": row.get('Pandemia', ''),
                "frequency": row.get('Frequencia', ''),
                "frequency_what": row.get('Oq_Frequencia', ''),
                "combination_category": row.get('Ql_combina_cat', '')
            }
            
            # Metadados
            metadata = {
                "area": area_map.get(row.get('Zona'), 'Área 1 - Área Central'),
                "city": "Recife",
                "date": f"{row.get('Ano_da_Pesquisa', '2024')}-01-01T03:00:00.000Z",
                "hour": "1899-12-30T17:00:00.000Z",
                "weekday": row.get('Dia_Semana', 'segunda-feira'),
                "location": {
                    "type": "Point",
                    "coordinates": parse_coordinates(row.get('latitude', '-8.0'), row.get('coordinates', '-34.9'))
                },
                "bike_type": bike_map.get(row.get('Bike'), 'Privada'),
                "sheet_index": idx,
                "neighborhood": row.get('Bairro', 'Recife'),
                "researcher_code": int(row.get('Cod_Pesq', 30786)) if row.get('Cod_Pesq', '').isdigit() else 30786,
                # Campos adicionais
                "survey_year": int(row.get('Ano da Pesquisa', 2024)) if row.get('Ano da Pesquisa', '').isdigit() else 2024,
                "datetime_original": row.get('Data_Hora', ''),
                "questionnaire_number": row.get('N_Quest', ''),
                "original_date": row.get('Data', ''),
                "schedule": row.get('Horario', ''),
                "street": row.get('Logradouro', '')
            }
            
            # Estrutura final
            entry = {
                "id": idx,
                "data": data,
                "metadata": metadata,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f"),
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
            }
            
            results.append(entry)
    
    # Salva o JSON
    with open(output_file_path, 'w', encoding='utf-8') as file:
        json.dump(results, file, ensure_ascii=False, indent=2)
    
    print(f"Convertidos {len(results)} registros para {output_file_path}")

if __name__ == "__main__":
    csv_path = "Relatório unificado Pesquisa Perfil 2015, 2018, 2021 e 2024 - RECIFE - Pesquisas Perfil Ciclista Recife.csv"
    json_path = "converted_data.json"
    
    convert_csv_to_json(csv_path, json_path)