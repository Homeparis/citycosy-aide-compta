'use client';

import { useState } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Factures() {
  const router = useRouter();
  const [csvData, setCsvData] = useState([]);
  const [typeFacture, setTypeFacture] = useState(''); // 'locataire' ou 'proprietaire'
  const [errors, setErrors] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map(line => {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ';' && !inQuotes) {
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

  const detectType = (data) => {
    const firstRow = data[0];
    if (firstRow['Appartement'] && firstRow['Client']) {
      return 'locataire';
    } else if (firstRow['Propriétaire Nom']) {
      return 'proprietaire';
    }
    return 'unknown';
  };

  const validateLocataire = (data) => {
    const errors = [];
    const requiredFields = ['Appartement', 'Arrivée', 'Départ', 'Client', 'N° Facture', 'Date Facture', 'N° Client', 'Frais Agence TTC', 'Échéance'];
    
    data.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errors.push(`Ligne ${index + 2}: Champ "${field}" manquant`);
        }
      });
    });
    
    return errors;
  };

  const validateProprietaire = (data) => {
    const errors = [];
    const requiredFields = ['N° Facture', 'Date Facture', 'N° Client', 'Propriétaire Nom', 'Référence', 'Montant TTC', 'Échéance'];
    
    data.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errors.push(`Ligne ${index + 2}: Champ "${field}" manquant`);
        }
      });
    });
    
    return errors;
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCSV(text);
    
    if (parsed.length === 0) {
      alert('❌ Le fichier CSV est vide');
      return;
    }

    const type = detectType(parsed);
    if (type === 'unknown') {
      alert('❌ Format CSV non reconnu. Vérifiez les colonnes.');
      return;
    }

    setTypeFacture(type);
    setCsvData(parsed);

    const validationErrors = type === 'locataire' 
      ? validateLocataire(parsed) 
      : validateProprietaire(parsed);
    
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      alert(`✅ ${parsed.length} factures ${type} chargées avec succès`);
    } else {
      alert(`⚠️ ${parsed.length} factures chargées avec ${validationErrors.length} erreurs`);
    }
  };

  // ========== MODIFICATION ICI : UN SEUL PDF ==========
  const genererFactures = async () => {
    if (csvData.length === 0) {
      alert('Veuillez charger un CSV');
      return;
    }

    if (errors.length > 0) {
      const confirm = window.confirm(`Il y a ${errors.length} erreurs. Continuer quand même ?`);
      if (!confirm) return;
    }

    setIsGenerating(true);

    // Import dynamique de jsPDF (JSZip n'est plus nécessaire)
    const { jsPDF } = await import('jspdf');

    // Créer UN SEUL document PDF
    const doc = new jsPDF();

    csvData.forEach((row, index) => {
      // Ajouter une nouvelle page pour chaque facture (sauf la première)
      if (index > 0) {
        doc.addPage();
      }
      
      if (typeFacture === 'locataire') {
        genererFactureLocataire(doc, row);
      } else {
        genererFactureProprietaire(doc, row);
      }
    });

    // Télécharger le PDF unique
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Nom du fichier selon le type de factures
    const typeNom = typeFacture === 'locataire' ? 'locataires' : 'gestion';
    a.download = `factures_${typeNom}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    a.click();
    URL.revokeObjectURL(url);

    setIsGenerating(false);
    alert(`✅ ${csvData.length} factures générées dans UN SEUL PDF !`);
  };
  // ========== FIN DE LA MODIFICATION ==========

  const genererFactureLocataire = (doc, row) => {
    // En-tête CityCosy
    doc.setFontSize(10);
    doc.text('CityCosy Strasbourg (SAS Omnia)', 105, 20, { align: 'center' });
    doc.text('14 rue des Bonnes Gens', 105, 25, { align: 'center' });
    doc.text('67000 - STRASBOURG', 105, 30, { align: 'center' });
    doc.text('France', 105, 35, { align: 'center' });
    doc.setFontSize(8);
    doc.text('Tél. : 03.69.23.21.02 - Siret : 84511118600019', 105, 40, { align: 'center' });
    doc.text('Port. : 06.19.35.29.88', 105, 45, { align: 'center' });
    doc.text('Email : pierre@citycosy.com', 105, 50, { align: 'center' });

    // Titre FACTURE
    doc.setFontSize(24);
    doc.setTextColor(255, 0, 0);
    doc.text('Facture', 150, 20);
    doc.setTextColor(0, 0, 0);

    // Numéro et date
    doc.setFontSize(10);
    doc.text(`N° : ${row['N° Facture']}`, 20, 70);
    doc.text(`Date : ${row['Date Facture']}`, 20, 76);
    doc.text(`N° client : ${row['N° Client']}`, 20, 82);

    // Client
    doc.text(row.Client, 150, 70);
    doc.text('xx', 150, 76);
    doc.text('xx xx', 150, 82);

    // Référence
    const reference = `${row.Appartement} - séjour du ${row.Arrivée} au ${row.Départ}`;
    doc.setFontSize(11);
    doc.setTextColor(255, 0, 0);
    doc.text(`Réf. : ${reference}`, 20, 100);
    doc.setTextColor(0, 0, 0);

    // Tableau des montants
    const fraisAgence = parseFloat(row['Frais Agence TTC'].replace(',', '.')) || 0;
    const fraisMenage = row['Frais Ménage TTC'] ? parseFloat(row['Frais Ménage TTC'].replace(',', '.')) : 0;

    const totalTTC = fraisAgence + fraisMenage;
    const totalHT = totalTTC / 1.20;
    const tva = totalTTC - totalHT;

    let yPos = 115;
    doc.setFontSize(10);
    doc.text('Libellé', 25, yPos);
    doc.text('Montant HT', 145, yPos);
    
    yPos += 8;
    if (fraisAgence > 0) {
      const htAgence = fraisAgence / 1.20;
      doc.text('S012 - Frais Agence', 25, yPos);
      doc.text(`${htAgence.toFixed(2)} €`, 145, yPos);
      yPos += 6;
    }
    
    if (fraisMenage > 0) {
      const htMenage = fraisMenage / 1.20;
      doc.text('S006 - Frais de ménage', 25, yPos);
      doc.text(`${htMenage.toFixed(2)} €`, 145, yPos);
      yPos += 6;
    }

    yPos += 10;
    doc.text('Total HT', 130, yPos);
    doc.text(`${totalHT.toFixed(2)} €`, 170, yPos, { align: 'right' });
    yPos += 6;
    doc.text('TVA (20%)', 130, yPos);
    doc.text(`${tva.toFixed(2)} €`, 170, yPos, { align: 'right' });
    yPos += 8;
    
    // Total TTC en rouge
    doc.setFillColor(255, 0, 0);
    doc.rect(125, yPos - 6, 60, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Total TTC', 130, yPos);
    doc.text(`${totalTTC.toFixed(2)} €`, 180, yPos, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    yPos += 15;
    doc.text('Échéance(s)', 20, yPos);
    doc.text(`${totalTTC.toFixed(2)} € au ${row['Échéance']}`, 60, yPos);

    // Footer
    doc.setFontSize(7);
    doc.text('OMNIA - 14 rue des Bonnes Gens 67000 STRASBOURG - Tel. : 03.69.23.21.02', 105, 270, { align: 'center' });
    doc.text('SIRET : 84511118600019 - N° TVA FR47845111186', 105, 275, { align: 'center' });
  };

  const genererFactureProprietaire = (doc, row) => {
    doc.setFontSize(10);
    doc.text('CityCosy Strasbourg (SAS Omnia)', 105, 20, { align: 'center' });
    doc.text('14 rue des Bonnes Gens - 67000 STRASBOURG', 105, 25, { align: 'center' });

    doc.setFontSize(24);
    doc.setTextColor(255, 0, 0);
    doc.text('Facture', 150, 20);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(10);
    doc.text(`N° : ${row['N° Facture']}`, 20, 60);
    doc.text(`Date : ${row['Date Facture']}`, 20, 66);
    doc.text(`N° client : ${row['N° Client']}`, 20, 72);

    doc.text(row['Propriétaire Nom'], 150, 60);
    doc.text(row['Propriétaire Adresse'] || 'xx', 150, 66);
    doc.text(row['Propriétaire CP Ville'] || 'xx xx', 150, 72);

    doc.setFontSize(11);
    doc.setTextColor(255, 0, 0);
    doc.text(`Réf. : ${row['Référence']}`, 20, 90);
    doc.setTextColor(0, 0, 0);

    const montantTTC = parseFloat(row['Montant TTC'].replace(',', '.')) || 0;
    const montantHT = montantTTC / 1.20;
    const tva = montantTTC - montantHT;

    let yPos = 105;
    doc.text('Libellé', 25, yPos);
    doc.text('Montant HT', 145, yPos);
    yPos += 8;
    doc.text('S002 - Frais de gestion', 25, yPos);
    doc.text(`${montantHT.toFixed(2)} €`, 145, yPos);

    yPos += 20;
    doc.text('Total HT', 130, yPos);
    doc.text(`${montantHT.toFixed(2)} €`, 170, yPos, { align: 'right' });
    yPos += 6;
    doc.text('TVA (20%)', 130, yPos);
    doc.text(`${tva.toFixed(2)} €`, 170, yPos, { align: 'right' });
    yPos += 8;
    doc.setFillColor(255, 0, 0);
    doc.rect(125, yPos - 6, 60, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Total TTC', 130, yPos);
    doc.text(`${montantTTC.toFixed(2)} €`, 180, yPos, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    yPos += 15;
    doc.text('Échéance(s)', 20, yPos);
    doc.text(`${montantTTC.toFixed(2)} € au ${row['Échéance']}`, 60, yPos);

    doc.setFontSize(7);
    doc.text('OMNIA - 14 rue des Bonnes Gens 67000 STRASBOURG - SIRET : 84511118600019', 105, 270, { align: 'center' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            ← Retour à la fusion
          </button>
        </div>

        <div className="text-center mb-12">
          <div className="inline-block bg-gradient-to-r from-red-600 to-black px-8 py-4 rounded-2xl shadow-2xl mb-4">
            <h1 className="text-4xl font-bold text-white">Génération de Factures</h1>
          </div>
          <p className="text-gray-600 text-lg">Uploadez votre CSV enrichi pour générer vos factures PDF</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-12 h-12 mb-4 text-gray-500" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Cliquez pour uploader</span> ou glissez-déposez
                </p>
                <p className="text-xs text-gray-500">CSV enrichi (locataires ou gestion)</p>
              </div>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleCSVUpload}
              />
            </label>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="text-yellow-600" size={24} />
              <h3 className="font-bold text-yellow-800">Erreurs de validation ({errors.length})</h3>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 max-h-60 overflow-y-auto">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {csvData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <div className="flex items-center gap-2 mb-6">
              <CheckCircle className="text-green-600" size={24} />
              <h3 className="font-bold text-xl">
                {csvData.length} factures {typeFacture === 'locataire' ? 'locataires' : 'de gestion'} chargées
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left">N° Facture</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Client/Propriétaire</th>
                    <th className="px-3 py-2 text-right">Montant TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 10).map((row, i) => {
                    const montantTTC = typeFacture === 'locataire'
                      ? parseFloat(row['Frais Agence TTC'].replace(',', '.')) + parseFloat((row['Frais Ménage TTC'] || '0').replace(',', '.'))
                      : parseFloat(row['Montant TTC'].replace(',', '.'));
                    
                    return (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{row['N° Facture']}</td>
                        <td className="px-3 py-2">{row['Date Facture']}</td>
                        <td className="px-3 py-2">
                          {typeFacture === 'locataire' ? row.Client : row['Propriétaire Nom']}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {montantTTC.toFixed(2)} €
                        </td>
                      </tr>
                    );
                  })}
                  {csvData.length > 10 && (
                    <tr className="border-t bg-gray-50">
                      <td colSpan="4" className="px-3 py-2 text-center text-gray-600">
                        ... et {csvData.length - 10} autres factures
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button
            onClick={genererFactures}
            disabled={csvData.length === 0 || isGenerating}
            className="bg-red-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-red-700 transition flex items-center gap-2 disabled:bg-gray-400 shadow-lg"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                Génération en cours...
              </>
            ) : (
              <>
                <FileText size={24} />
                Générer toutes les factures (PDF unique)
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
