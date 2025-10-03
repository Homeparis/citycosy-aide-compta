'use client';

import { useState } from 'react';
import { Upload, Download, RefreshCw, CheckCircle } from 'lucide-react';

export default function Home() {
  const [lodgifyData, setLodgifyData] = useState([]);
  const [airbnbData, setAirbnbData] = useState([]);
  const [fusedData, setFusedData] = useState([]);

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map(line => {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));
      
      const row = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });
  };

  const handleLodgifyUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCSV(text);
    
    const data = parsed.map(row => ({
      code: row.SourceText || row.Code || '',
      client: row.Name || row.Client || '',
      appartement: row.HouseName || row.Appartement || '',
      arrivee: row.DateArrival || row.Arrivée || '',
      depart: row.DateDeparture || row.Départ || '',
      source: 'Lodgify',
      montant: parseFloat((row.TotalAmount || row.Total || '0').replace(',', '.'))
    }));

    setLodgifyData(data);
    alert(`✅ ${data.length} réservations Lodgify chargées`);
  };

  const handleAirbnbUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCSV(text);
    
    const data = parsed.map(row => ({
      code: row['Confirmation code'] || row['Code de confirmation'] || '',
      client: row['Guest name'] || row['Nom du voyageur'] || '',
      appartement: row.Listing || row.Annonce || '',
      arrivee: row['Start date'] || row['Date de début'] || '',
      depart: row['End date'] || row['Date de fin'] || '',
      source: 'Airbnb',
      montant: parseFloat((row.Earnings || row.Revenus || '0').toString().replace(/[€$,]/g, ''))
    }));

    setAirbnbData(data);
    alert(`✅ ${data.length} réservations Airbnb chargées`);
  };

  const fusionner = () => {
    const all = [...lodgifyData, ...airbnbData];
    const sorted = all.sort((a, b) => {
      if (a.appartement !== b.appartement) {
        return a.appartement.localeCompare(b.appartement);
      }
      return new Date(a.arrivee) - new Date(b.arrivee);
    });
    setFusedData(sorted);
  };

  const exporter = () => {
    if (fusedData.length === 0) return;
    
    const csv = [
      'Appartement,Arrivée,Départ,Client,Code,Source,Montant',
      ...fusedData.map(r => 
        `"${r.appartement}",${r.arrivee},${r.depart},"${r.client}",${r.code},${r.source},${r.montant}`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citycosy_fusion_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const reinitialiser = () => {
    setLodgifyData([]);
    setAirbnbData([]);
    setFusedData([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-3">
            🏠 CityCosy Aide Compta
          </h1>
          <p className="text-xl text-gray-600">Fusion Lodgify + Airbnb</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-blue-600 mb-4">📘 Lodgify</h2>
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition">
                <Upload className="mx-auto mb-3 text-gray-400" size={40} />
                <p className="text-gray-600">Cliquez pour charger le CSV Lodgify</p>
              </div>
              <input type="file" className="hidden" accept=".csv" onChange={handleLodgifyUpload} />
            </label>
            {lodgifyData.length > 0 && (
              <div className="mt-4 flex items-center text-green-600">
                <CheckCircle className="mr-2" />
                <span className="font-semibold">{lodgifyData.length} réservations</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-pink-600 mb-4">🏡 Airbnb</h2>
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-pink-500 hover:bg-pink-50 cursor-pointer transition">
                <Upload className="mx-auto mb-3 text-gray-400" size={40} />
                <p className="text-gray-600">Cliquez pour charger le CSV Airbnb</p>
              </div>
              <input type="file" className="hidden" accept=".csv" onChange={handleAirbnbUpload} />
            </label>
            {airbnbData.length > 0 && (
              <div className="mt-4 flex items-center text-green-600">
                <CheckCircle className="mr-2" />
                <span className="font-semibold">{airbnbData.length} réservations</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={fusionner}
            className="bg-indigo-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <RefreshCw size={24} />
            Fusionner
          </button>
          
          <button
            onClick={exporter}
            className="bg-green-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <Download size={24} />
            Exporter CSV
          </button>

          <button
            onClick={reinitialiser}
            className="bg-gray-500 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-600 transition"
          >
            Réinitialiser
          </button>
        </div>

        {fusedData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-bold mb-4 text-gray-800">
              📊 {fusedData.length} réservations fusionnées
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Appartement</th>
                    <th className="px-4 py-3 text-left font-bold">Arrivée</th>
                    <th className="px-4 py-3 text-left font-bold">Départ</th>
                    <th className="px-4 py-3 text-left font-bold">Client</th>
                    <th className="px-4 py-3 text-left font-bold">Code</th>
                    <th className="px-4 py-3 text-left font-bold">Source</th>
                    <th className="px-4 py-3 text-right font-bold">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {fusedData.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{row.appartement}</td>
                      <td className="px-4 py-3">{row.arrivee}</td>
                      <td className="px-4 py-3">{row.depart}</td>
                      <td className="px-4 py-3">{row.client}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.code}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          row.source === 'Lodgify' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-pink-100 text-pink-800'
                        }`}>
                          {row.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{row.montant.toFixed(2)}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}