
import React, { useState, useEffect } from 'react';
import { ChecklistTemplate, ChecklistResponse } from '../types';
import { supabaseService } from '../services/supabaseService';
import { generateChecklistPDF } from '../utils/pdfGenerator';

interface ChecklistSummaryProps {
  template: ChecklistTemplate;
  responseId: string;
  onBack: () => void;
}

const ChecklistSummary: React.FC<ChecklistSummaryProps> = ({ template, responseId, onBack }) => {
  const [response, setResponse] = useState<ChecklistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchResponse = async () => {
      setLoading(true);
      try {
        const found = await supabaseService.getResponseById(responseId);
        if (found) {
          setResponse(found);
        } else {
          alert("Erro: Checklist não encontrado.");
          onBack();
        }
      } catch (err) {
        console.error("Erro ao buscar detalhes do checklist:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResponse();
  }, [responseId]);

  const handleDelete = async () => {
    if (!response) return;
    if (!window.confirm('🚨 ATENÇÃO: Deseja realmente excluir este registro permanentemente?')) return;

    setIsDeleting(true);
    try {
      await supabaseService.deleteResponse(response.id);
      onBack();
    } catch (err) {
      alert('Erro ao excluir o checklist.');
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadPDF = async () => {
    if (!response) return;
    try {
      const doc = await generateChecklistPDF(response, template);
      const d = new Date(response.updatedAt);
      const dateStr = d.toISOString().split('T')[0];
      const filename = `${response.customId || 'REG'}_${template.title}_${dateStr}`.replace(/[^a-z0-9_-]/gi, '_');
      doc.save(`${filename}.pdf`);
    } catch (err) {
      alert("Erro ao gerar o arquivo PDF.");
    }
  };

  const getQuestionData = (stageId: string, qId: string, rawData: any) => {
    const qData = rawData?.[stageId]?.[qId];
    if (qData && typeof qData === 'object' && ('val' in qData)) {
      return {
        val: qData.val,
        imgs: qData.imgs || [],
        docs: qData.docs || [],
        note: qData.note || ''
      };
    }
    return { val: qData || null, imgs: [], docs: [], note: '' };
  };

  if (loading) return (
    <div className="p-20 text-center">
      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="font-black uppercase text-gray-400 text-xs tracking-widest">Sincronizando Dados Cloud...</p>
    </div>
  );

  if (!response) return null;

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto px-4 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center py-6 border-b gap-4">
        <div>
          <button onClick={onBack} className="text-orange-600 font-bold text-xs uppercase mb-1 hover:underline">← Voltar</button>
          <h2 className="text-2xl font-black uppercase text-gray-900">Relatório #{response.customId}</h2>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={handleDelete} disabled={isDeleting} className="flex-1 md:flex-none bg-red-50 text-red-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all disabled:opacity-50">
            {isDeleting ? 'Excluindo...' : '🗑️ Excluir'}
          </button>
          {response.pdfUrl && (
            <a 
              href={response.pdfUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 md:flex-none bg-green-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg tracking-widest hover:bg-green-700 transition-colors flex items-center justify-center"
            >
              📄 Abrir Original
            </a>
          )}
          <button onClick={downloadPDF} className="flex-1 md:flex-none bg-orange-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg tracking-widest hover:bg-orange-700 transition-colors">Baixar PDF</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {response.externalDataRow && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <span className="text-orange-600">📋</span>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Detalhes da Ordem de Serviço</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">OS</p>
                  <p className="text-xs font-bold text-gray-900">{response.externalDataRow.os}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Doca</p>
                  <p className="text-xs font-bold text-gray-900">{response.externalDataRow.doca || '---'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Veículo</p>
                  <p className="text-xs font-bold text-gray-900">{response.externalDataRow.veiculo || '---'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Produto</p>
                  <p className="text-xs font-bold text-gray-900">{response.externalDataRow.cod_produto} {response.externalDataRow.desc_produto}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cliente</p>
                  <p className="text-xs font-bold text-gray-900">{response.externalDataRow.cliente}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tipo Programa</p>
                  <p className="text-xs font-bold text-gray-900">{response.externalDataRow.tipo_programa}</p>
                </div>
              </div>
            </div>
          )}

          {template.stages.map((stage, sIdx) => (
            <div key={stage.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 bg-orange-50/50 border-b flex items-center gap-4">
                <span className="w-8 h-8 bg-orange-600 text-white rounded-lg flex items-center justify-center font-black text-sm shadow-md">{sIdx + 1}</span>
                <h3 className="text-sm font-black text-orange-900 uppercase tracking-widest">{stage.name}</h3>
              </div>
              
              <div className="divide-y divide-gray-50">
                {stage.questions.map((q) => {
                  const qData = getQuestionData(stage.id, q.id, response.data);
                  return (
                    <div key={q.id} className="p-6 space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 flex items-center">
                          <span className="w-1.5 h-1.5 bg-orange-600 rounded-full mr-2"></span>
                          {q.text}
                        </h4>
                        
                        {q.type === 'SIGNATURE' ? (
                          <div className="mt-3 p-4 bg-gray-50 border-2 border-dashed border-gray-100 rounded-2xl inline-block shadow-inner">
                            {qData.val ? <img src={qData.val} className="max-h-32 object-contain" alt="Assinatura" /> : <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest italic">Não assinado</span>}
                          </div>
                        ) : q.type === 'OS' ? (
                          <div className="mt-2 space-y-2">
                            <div className="inline-block px-4 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-black uppercase shadow-sm border border-orange-100">
                              OS: {qData.val || 'Não respondido'}
                            </div>
                            {qData.val && template.externalData?.find(r => r.os === qData.val) && (
                              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-[10px] font-black uppercase text-blue-900 space-y-1">
                                {(() => {
                                  const row = template.externalData.find(r => r.os === qData.val);
                                  return row ? (
                                    <>
                                      <p><span className="text-blue-400">Doca:</span> {row.doca || '---'}</p>
                                      <p><span className="text-blue-400">Programa:</span> {row.tipo_programa}</p>
                                      <p><span className="text-blue-400">Veículo:</span> {row.veiculo || '---'}</p>
                                      <p><span className="text-blue-400">Produto:</span> {row.cod_produto || ''} {row.desc_produto || ''}</p>
                                      <p><span className="text-blue-400">Cliente:</span> {row.cliente}</p>
                                    </>
                                  ) : null;
                                })()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 inline-block px-4 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-black uppercase shadow-sm border border-orange-100">
                            {Array.isArray(qData.val) ? qData.val.join(', ') : String(qData.val || 'Não respondido')}
                          </div>
                        )}
                      </div>

                      {qData.imgs && qData.imgs.length > 0 && (
                        <div className="space-y-2">
                           <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Imagens Anexadas:</p>
                           <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                            {qData.imgs.map((img: string, i: number) => (
                              <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-100 cursor-pointer shadow-sm hover:scale-105 transition-transform" onClick={() => setPreviewImage(img)}>
                                <img src={img} className="w-full h-full object-cover" alt={`Evidência ${i+1}`} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {qData.docs && qData.docs.length > 0 && (
                        <div className="space-y-2">
                           <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Documentos Anexados:</p>
                           <div className="space-y-2">
                            {qData.docs.map((doc: any, i: number) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-[10px] font-bold text-gray-600 truncate max-w-[200px]">📄 {doc.name}</span>
                                {doc.url && (
                                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-orange-600 uppercase hover:underline">Baixar</a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {qData.note && (
                        <div className="p-4 bg-gray-50 border-l-4 border-orange-600 rounded-r-2xl shadow-sm">
                          <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">Observação:</p>
                          <p className="text-xs font-medium text-gray-700 leading-relaxed italic">"{qData.note}"</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {response.divergences?.[stage.id] && response.divergences[stage.id].length > 0 && (
                <div className="p-6 bg-red-50/50 border-t border-red-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    <h4 className="text-[10px] font-black text-red-900 uppercase tracking-widest">Divergências Relatadas nesta Etapa</h4>
                  </div>
                  <div className="space-y-4">
                    {response.divergences[stage.id].map((div) => (
                      <div key={div.id} className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm space-y-3">
                        <p className="text-xs font-bold text-gray-800">{div.comment}</p>
                        
                        {div.images.length > 0 && (
                          <div className="grid grid-cols-4 gap-2">
                            {div.images.map((img, i) => (
                              <img key={i} src={img} className="aspect-square rounded-lg object-cover border border-gray-100 cursor-pointer" onClick={() => setPreviewImage(img)} />
                            ))}
                          </div>
                        )}

                        {(div.videos.length > 0 || div.files.length > 0) && (
                          <div className="flex flex-wrap gap-2">
                            {div.videos.map((vid, i) => (
                              <a key={i} href={vid} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-gray-100 text-[9px] font-black text-gray-600 rounded-full uppercase border border-gray-200">🎥 Vídeo {i+1}</a>
                            ))}
                            {div.files.map((f, i) => (
                              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-gray-100 text-[9px] font-black text-gray-600 rounded-full uppercase border border-gray-200">📄 {f.name}</a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm sticky top-24">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-gray-400 mb-6">Metadados da Inspeção</h4>
            <div className="space-y-4">
               <div>
                 <p className="text-[9px] font-black text-gray-400 uppercase">Status Final</p>
                 <p className="text-green-600 font-black uppercase text-sm">✓ Concluído</p>
               </div>
               <div>
                 <p className="text-[9px] font-black text-gray-400 uppercase">Finalizado em</p>
                 <p className="text-gray-800 font-bold text-sm">{new Date(response.updatedAt).toLocaleString('pt-BR')}</p>
               </div>
               <div>
                 <p className="text-[9px] font-black text-gray-400 uppercase">ID de Referência</p>
                 <p className="text-gray-800 font-bold text-sm">{response.customId}</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 animate-fadeIn" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-full rounded-2xl shadow-2xl" alt="Zoom" />
        </div>
      )}
    </div>
  );
};

export default ChecklistSummary;
