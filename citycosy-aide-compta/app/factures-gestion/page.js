'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FacturesGestion() {
  const [invoicesData, setInvoicesData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUpload, setShowUpload] = useState(true);
  const [isPrintingAll, setIsPrintingAll] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      const headers = lines[0].split(/[,;]/).map(h => h.trim().replace(/^"|"$/g, ''));
      const data = lines.slice(1).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if ((char === ',' || char === ';') && !inQuotes) {
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
      }).filter(row => row['N° Facture'] && row['Propriétaire Nom']);

      setInvoicesData(data);
      setShowUpload(false);
      setCurrentIndex(0);
    };
    
    reader.readAsText(file);
  };

  const parseAmount = (value) => {
    if (!value || value === '0') return 0;
    return parseFloat(value.toString().replace(',', '.'));
  };

  const calculateHT = (ttc) => ttc / 1.20;
  const calculateTVA = (ttc) => ttc - calculateHT(ttc);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const printAllInvoices = async () => {
    if (confirm(`Voulez-vous imprimer les ${invoicesData.length} factures ?\n\nElles s'ouvriront successivement pour impression/sauvegarde PDF.`)) {
      setIsPrintingAll(true);
      for (let i = 0; i < invoicesData.length; i++) {
        setCurrentIndex(i);
        await new Promise(resolve => setTimeout(resolve, 500));
        window.print();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setIsPrintingAll(false);
      alert('Impression terminée !');
    }
  };

  if (showUpload || invoicesData.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/">
            <button className="mb-6 px-6 py-2 bg-white text-gray-700 rounded-lg font-semibold hover:bg-gray-200 shadow-md transition">
              ← Retour à l'accueil
            </button>
          </Link>
          
          <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
            <div className="inline-block bg-gradient-to-r from-red-600 to-black px-8 py-4 rounded-2xl shadow-xl mb-6">
              <h1 className="text-4xl font-black text-white tracking-tight">
                City<span className="text-red-300">Cosy</span>
              </h1>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Factures de Gestion</h2>
            <p className="text-lg text-gray-600 mb-8">CityCosy Strasbourg - Propriétaires</p>

            <label className="block cursor-pointer">
              <div className="border-4 border-dashed border-gray-300 rounded-xl p-12 hover:border-green-500 hover:bg-green-50 transition">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-xl font-semibold text-gray-700 mb-2">Sélectionnez le CSV Propriétaires</p>
                <p className="text-sm text-gray-500">Format : Factures de gestion mensuelles</p>
              </div>
              <input type="file" className="hidden" accept=".csv" onChange={handleFileSelect} />
            </label>
          </div>
        </div>
      </div>
    );
  }

  if (!invoicesData[currentIndex]) return null;

  const currentInvoice = invoicesData[currentIndex];
  const montantTTC = parseAmount(currentInvoice['Montant TTC']);
  const montantHT = calculateHT(montantTTC);
  const montantTVA = calculateTVA(montantTTC);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Contrôles */}
      <div className="max-w-5xl mx-auto mb-4 bg-white rounded-xl shadow-lg p-4 print:hidden">
        <div className="flex justify-between items-center mb-4">
          <Link href="/">
            <button className="px-6 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700">
              ← Retour
            </button>
          </Link>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{currentIndex + 1} / {invoicesData.length}</div>
            <div className="text-sm text-gray-600">Factures</div>
          </div>

          <button
            onClick={() => setShowUpload(true)}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700"
          >
            Nouveau fichier
          </button>
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg disabled:bg-gray-300 hover:bg-green-700 font-semibold"
          >
            ◀ Précédente
          </button>

          <div className="flex gap-4">
            <button
              onClick={() => window.print()}
              className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 shadow-lg"
            >
              🖨️ Imprimer cette facture
            </button>
            
            <button
              onClick={printAllInvoices}
              disabled={isPrintingAll}
              className="px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 shadow-lg disabled:bg-gray-400"
            >
              📑 {isPrintingAll ? 'Impression en cours...' : 'Imprimer toutes'}
            </button>
          </div>

          <button
            onClick={() => setCurrentIndex(Math.min(invoicesData.length - 1, currentIndex + 1))}
            disabled={currentIndex === invoicesData.length - 1}
            className="px-6 py-2 bg-green-600 text-white rounded-lg disabled:bg-gray-300 hover:bg-green-700 font-semibold"
          >
            Suivante ▶
          </button>
        </div>
      </div>

      {/* Facture */}
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-2xl p-12 print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="inline-block bg-gradient-to-r from-red-600 to-black px-6 py-3 rounded-xl shadow-lg mb-4">
              <h1 className="text-2xl font-black text-white tracking-tight">
                City<span className="text-red-300">Cosy</span>
              </h1>
            </div>
            <div className="text-xs leading-relaxed text-gray-700 mt-2">
              <strong className="block text-sm mb-1">CityCosy Strasbourg (SAS Omnia)</strong>
              14 rue des Bonnes Gens<br/>67000 - STRASBOURG<br/>France<br/>
              Tél. : 03.69.23.21.02<br/>Port. : 06.19.35.29.88<br/>
              Siret : 84511118600019<br/>Email : pierre@citycosy.com
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-5xl font-bold text-red-600 mb-2">Facture</h1>
          </div>
        </div>

        {/* Infos */}
        <div className="flex justify-between mb-6 text-sm">
          <div>
            <p className="mb-1"><strong>N° : {currentInvoice['N° Facture']}</strong></p>
            <p className="mb-1">Date : {formatDate(currentInvoice['Date Facture'])}</p>
            <p>N° client : {currentInvoice['N° Client']}</p>
          </div>
          <div className="text-right">
            <strong className="block text-sm mb-1">{currentInvoice['Propriétaire Nom']}</strong>
            <p className="text-gray-700">{currentInvoice['Propriétaire Adresse']}</p>
            <p className="text-gray-700">{currentInvoice['Propriétaire CP']} {currentInvoice['Propriétaire Ville']}</p>
          </div>
        </div>

        {/* Référence */}
        <div className="bg-gray-50 border-l-4 border-red-600 p-3 mb-6">
          <strong className="text-red-600">Réf. : {currentInvoice['Référence']}</strong>
        </div>

        {/* Tableau */}
        <table className="w-full mb-6 text-xs border-collapse">
          <thead className="bg-red-600 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Libellé</th>
              <th className="px-3 py-2 text-center">Qté</th>
              <th className="px-3 py-2 text-center">Unité</th>
              <th className="px-3 py-2 text-right">PU HT</th>
              <th className="px-3 py-2 text-right">Rem.</th>
              <th className="px-3 py-2 text-right">Montant HT</th>
              <th className="px-3 py-2 text-right">TVA</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-3 py-2">S002 -Frais de gestion</td>
              <td className="px-3 py-2 text-center">1,00</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right">{montantHT.toFixed(2)} €</td>
              <td className="px-3 py-2 text-right">0,00%</td>
              <td className="px-3 py-2 text-right">{montantHT.toFixed(2)} €</td>
              <td className="px-3 py-2 text-right">20,00%</td>
            </tr>
          </tbody>
        </table>

        {/* Paiement */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6 text-xs leading-relaxed">
          <strong className="block mb-2">Pour vos règlements par virement :</strong>
          IBAN : FR7614707500203232141447925<br/>BIC : CCBPFRPPMTZ<br/><br/>
          Pas d'escompte pour règlement anticipé. En cas de retard de paiement, une pénalité égale à 3 fois le taux intérêt légal sera exigible.
        </div>

        {/* Totaux */}
        <div className="flex justify-between gap-8 mb-6">
          <div className="flex-1">
            <h4 className="font-bold text-red-600 mb-2">Détail de la TVA</h4>
            <table className="w-full text-xs border">
              <tbody>
                <tr>
                  <td className="border px-2 py-1"><strong>Code</strong></td>
                  <td className="border px-2 py-1"><strong>Base HT</strong></td>
                  <td className="border px-2 py-1"><strong>Taux</strong></td>
                  <td className="border px-2 py-1"><strong>Montant</strong></td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">Normale</td>
                  <td className="border px-2 py-1">{montantHT.toFixed(2)} €</td>
                  <td className="border px-2 py-1">20,00%</td>
                  <td className="border px-2 py-1">{montantTVA.toFixed(2)} €</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-4 text-xs">
              <p className="mb-1"><strong>Règlement</strong> Virement</p>
              {currentInvoice['Échéance'] && (
                <p><strong>Echéance(s)</strong> {montantTTC.toFixed(2)} € au {formatDate(currentInvoice['Échéance'])}</p>
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2">
                <strong>Total HT</strong>
                <strong>{montantHT.toFixed(2)} €</strong>
              </div>
              <div className="flex justify-between py-2">
                <strong>TVA</strong>
                <strong>{montantTVA.toFixed(2)} €</strong>
              </div>
              <div className="flex justify-between bg-red-600 text-white px-4 py-3 font-bold text-lg">
                <span>Total TTC</span>
                <span>{montantTTC.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer légal */}
        <div className="text-center text-xs leading-relaxed text-gray-600 pt-4 border-t">
          OMNIA, SAS au capital de 2000€, sise au 14 rue des Bonnes Gens 67000 STRASBOURG, représentée par son Président titulaire des cartes professionnelles de «gestion immobilière» et de «transactions sur immeubles et fonds de commerce» CPI 6701 2019 000 040 008 délivrées par la CCI de Strasbourg, assuré pour sa responsabilité civile professionnelle et garantie par le AXA France IARD, 313 Terrasses de l'Arche – 92727 NANTERRE Cedex montant maximum 110 000€ pour ses activités de Gestion, immatriculé au RCS de Strasbourg sous le numéro B 845 111 186.
        </div>
      </div>
    </div>
  );
}