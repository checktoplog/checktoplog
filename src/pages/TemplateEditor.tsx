
import React, { useState, useEffect } from 'react';
import { ChecklistTemplate, Stage, Question, QuestionType } from '../types';
import { supabaseService } from '../services/supabaseService';

interface TemplateEditorProps {
  onBack: () => void;
  editId?: string;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ onBack, editId }) => {
  const [loading, setLoading] = useState(!!(editId && editId !== ""));
  const [template, setTemplate] = useState<ChecklistTemplate>({
    id: editId && editId !== "" ? editId : `tmpl_${Math.random().toString(36).substr(2, 9)}`,
    title: '',
    signatureTitle: 'Assinatura do Responsável',
    customIdPlaceholder: '',
    image: '',
    stages: [
      { id: 'stg_1', name: 'Etapa na Empresa', questions: [], videos: [], allowDivergence: true },
      { id: 'stg_2', name: 'Etapa no Cliente', questions: [], videos: [], allowDivergence: true }
    ],
    allowExternalData: true
  });

  const [saving, setSaving] = useState(false);
  const [excelPaste, setExcelPaste] = useState('');

  const processExcelData = () => {
    if (!excelPaste.trim()) return;
    
    const lines = excelPaste.trim().split('\n');
    const newData = lines.map(line => {
      const cols = line.split('\t'); // Excel usually pastes as TSV
      if (cols.length < 3) return null; // At least Doca, Tipo, OS
      return {
        doca: cols[0]?.trim() || '',
        tipo_programa: cols[1]?.trim() || '',
        os: cols[2]?.trim() || '',
        veiculo: cols[3]?.trim() || '',
        data_inicio: cols[4]?.trim() || '',
        data_final: cols[5]?.trim() || '',
        cod_produto: cols[6]?.trim() || '',
        desc_produto: cols[7]?.trim() || '',
        cliente: cols[8]?.trim() || ''
      };
    }).filter(Boolean) as any[];

    if (newData.length > 0) {
      setTemplate(prev => ({ 
        ...prev, 
        externalData: newData,
        externalDataImportedAt: new Date().toISOString()
      }));
      setExcelPaste('');
      alert(`${newData.length} registros importados com sucesso!`);
    } else {
      alert('Nenhum dado válido encontrado. Certifique-se de copiar as colunas do Excel.');
    }
  };

  useEffect(() => {
    if (editId && editId !== "") {
      const fetchTemplate = async () => {
        setLoading(true);
        try {
          const templates = await supabaseService.getTemplates();
          const existing = templates.find(t => t.id === editId);
          if (existing) {
            setTemplate({
              id: existing.id,
              title: existing.title || '',
              signatureTitle: existing.signatureTitle || 'Assinatura do Responsável',
              customIdPlaceholder: existing.customIdPlaceholder || '',
              image: existing.image || '',
              stages: existing.stages || [],
              externalData: existing.externalData || [],
              externalDataImportedAt: existing.externalDataImportedAt,
              allowExternalData: existing.allowExternalData !== undefined ? existing.allowExternalData : true
            });
          } else {
            alert("Template não encontrado.");
            onBack();
          }
        } catch (e) {
          onBack();
        } finally {
          setLoading(false);
        }
      };
      fetchTemplate();
    }
  }, [editId]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; // Aumentado para melhor qualidade
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
          }
          resolve(canvas.toDataURL('image/jpeg', 0.85)); // Aumentado a qualidade
        };
      };
    });
  };

  const addStage = () => {
    setTemplate(prev => ({
      ...prev,
      stages: [...prev.stages, { id: `stg_${Math.random().toString(36).substr(2, 9)}`, name: `Nova Etapa`, questions: [], videos: [], allowDivergence: true }]
    }));
  };

  const removeStage = (idx: number) => {
    if (template.stages.length <= 1) return;
    setTemplate(prev => {
      const newStages = [...prev.stages];
      newStages.splice(idx, 1);
      return { ...prev, stages: newStages };
    });
  };

  const addQuestion = (stageIndex: number) => {
    setTemplate(prev => {
      const newStages = [...prev.stages];
      newStages[stageIndex].questions.push({ 
        id: `q_${Math.random().toString(36).substr(2, 9)}`, 
        text: '', 
        type: 'YES_NO', 
        required: true,
        allowImage: false,
        allowNote: false
      });
      return { ...prev, stages: newStages };
    });
  };

  const updateQuestion = (stageIdx: number, qIdx: number, updates: Partial<Question>) => {
    setTemplate(prev => {
      const newStages = [...prev.stages];
      newStages[stageIdx].questions[qIdx] = { ...newStages[stageIdx].questions[qIdx], ...updates };
      return { ...prev, stages: newStages };
    });
  };

  const removeExternalDataRow = (idx: number) => {
    if (window.confirm('Deseja excluir esta linha de OS?')) {
      setTemplate(prev => {
        const newData = [...(prev.externalData || [])];
        newData.splice(idx, 1);
        return { ...prev, externalData: newData };
      });
    }
  };

  const save = async () => {
    if (!template.title.trim()) return alert('Defina um título.');
    setSaving(true);
    console.log("TemplateEditor: Salvando modelo...", template.title);
    console.log("TemplateEditor: Dados Externos para salvar:", template.externalData?.length || 0, "registros");
    try {
      await supabaseService.saveTemplate(template);
      onBack();
    } catch (err: any) {
      console.error("Erro ao salvar modelo:", err);
      alert(`Erro ao salvar modelo: ${err.message || 'Verifique sua conexão.'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto px-4">
      <header className="flex justify-between items-center sticky top-0 bg-gray-50/95 py-4 z-30 border-b">
        <div>
          <button onClick={onBack} className="text-orange-600 font-bold text-sm mb-1">← Voltar</button>
          <h2 className="text-2xl font-black uppercase">{editId ? 'Editar Modelo' : 'Novo Modelo'}</h2>
        </div>
        <button onClick={save} disabled={saving} className="bg-orange-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase shadow-xl">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </header>

      <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-orange-100 space-y-6">
        <input
          type="text"
          className="w-full bg-gray-50 border-gray-100 rounded-xl p-4 text-xl font-black outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="Título do Checklist"
          value={template.title || ''}
          onChange={e => setTemplate(prev => ({ ...prev, title: e.target.value }))}
        />
        <input
          type="text"
          className="w-full bg-gray-50 border-gray-100 rounded-xl p-4 font-bold outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="Cargo do Responsável (Ex: Supervisor)"
          value={template.signatureTitle || ''}
          onChange={e => setTemplate(prev => ({ ...prev, signatureTitle: e.target.value }))}
        />
        <input
          type="text"
          className="w-full bg-gray-50 border-gray-100 rounded-xl p-4 font-bold outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="Exemplo do ID (Ex: VEÍCULO-01)"
          value={template.customIdPlaceholder || ''}
          onChange={e => setTemplate(prev => ({ ...prev, customIdPlaceholder: e.target.value }))}
        />
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Imagem de Capa (Opcional)</label>
          <div className="flex items-center gap-4">
            {template.image && (
              <img src={template.image} className="w-20 h-20 object-cover rounded-xl border" />
            )}
            <label className="flex-1 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-100 transition-colors">
              <span className="text-xs font-bold text-gray-400">Clique para selecionar imagem</span>
              <input type="file" className="hidden" accept="image/*" onChange={async e => {
                const file = e.target.files?.[0];
                if (file) {
                  setLoading(true);
                  try {
                    const comp = await compressImage(file);
                    const path = `cover_${template.id}_${Date.now()}.jpg`;
                    const url = await supabaseService.uploadFile('templates', path, comp);
                    setTemplate(prev => ({ ...prev, image: url || comp }));
                  } finally {
                    setLoading(false);
                  }
                }
              }} />
            </label>
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <label className={`flex items-center gap-2 cursor-pointer p-4 rounded-xl border transition-colors ${template.allowExternalData ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-100'}`}>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={template.allowExternalData} 
              onChange={e => setTemplate(prev => ({ ...prev, allowExternalData: e.target.checked }))} 
            />
            <span className="text-xl">{template.allowExternalData ? '✅' : '⬜'}</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase">Habilitar Importação Excel (OS)</span>
              <span className={`text-[8px] font-bold uppercase ${template.allowExternalData ? 'text-blue-100' : 'text-gray-400'}`}>
                Permite importar e selecionar ordens de serviço
              </span>
            </div>
          </label>
        </div>
      </section>

      {template.allowExternalData && (
        <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-blue-100 space-y-4 animate-scaleDown">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">📊</span>
            <h3 className="text-lg font-black uppercase text-blue-900">Importar Dados do Excel (OS)</h3>
          </div>
        <p className="text-xs text-gray-500 font-bold">
          Cole abaixo as colunas do Excel na ordem: <br/>
          <span className="text-blue-600">Doca | Tipo Programação | OS | Veículo | Data Início | Data Final | Cód Produto | Descrição Produto | Cliente</span>
        </p>
        <textarea
          className="w-full bg-gray-50 border-gray-100 rounded-xl p-4 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 h-32"
          placeholder="Cole aqui os dados copiados do Excel..."
          value={excelPaste}
          onChange={e => setExcelPaste(e.target.value)}
        />
        <div className="flex justify-between items-center">
          <button 
            onClick={processExcelData}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase shadow-lg"
          >
            Processar Dados
          </button>
          {template.externalData && template.externalData.length > 0 && (
            <div className="text-right flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-black text-green-600 uppercase">{template.externalData.length} Registros Carregados</p>
                {template.externalDataImportedAt && (
                  <p className="text-[8px] font-bold text-gray-400 uppercase">Importado em: {new Date(template.externalDataImportedAt).toLocaleString('pt-BR')}</p>
                )}
              </div>
              <button 
                onClick={() => {
                  if(window.confirm('Deseja limpar TODOS os dados de OS?')) {
                    setTemplate(prev => ({ ...prev, externalData: [], externalDataImportedAt: undefined }));
                  }
                }}
                className="bg-red-50 text-red-500 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                title="Limpar Tudo"
              >
                <span className="text-xs">🗑️</span>
              </button>
            </div>
          )}
        </div>

        {template.externalData && template.externalData.length > 0 && (
          <div className="mt-6 border border-blue-100 rounded-2xl overflow-hidden bg-gray-50">
            <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-200">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead className="sticky top-0 bg-blue-50 z-10">
                  <tr className="border-b border-blue-100">
                    <th className="p-3 font-black uppercase text-blue-900">Doca</th>
                    <th className="p-3 font-black uppercase text-blue-900">Tipo</th>
                    <th className="p-3 font-black uppercase text-blue-900">OS</th>
                    <th className="p-3 font-black uppercase text-blue-900">Veículo</th>
                    <th className="p-3 font-black uppercase text-blue-900">Início</th>
                    <th className="p-3 font-black uppercase text-blue-900">Final</th>
                    <th className="p-3 font-black uppercase text-blue-900">Cód Prod</th>
                    <th className="p-3 font-black uppercase text-blue-900">Descrição</th>
                    <th className="p-3 font-black uppercase text-blue-900">Cliente</th>
                    <th className="p-3 font-black uppercase text-blue-900 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {template.externalData.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-white transition-colors group">
                      <td className="p-3 font-medium text-gray-600">{row.doca}</td>
                      <td className="p-3 font-medium text-gray-600">{row.tipo_programa}</td>
                      <td className="p-3 font-black text-blue-600">{row.os}</td>
                      <td className="p-3 font-medium text-gray-500">{row.veiculo}</td>
                      <td className="p-3 font-medium text-gray-500">{row.data_inicio}</td>
                      <td className="p-3 font-medium text-gray-500">{row.data_final}</td>
                      <td className="p-3 font-medium text-gray-500">{row.cod_produto}</td>
                      <td className="p-3 font-medium text-gray-500 truncate max-w-[150px]" title={row.desc_produto}>{row.desc_produto}</td>
                      <td className="p-3 font-medium text-gray-500 truncate max-w-[150px]" title={row.cliente}>{row.cliente}</td>
                      <td className="p-3">
                        <button 
                          onClick={() => removeExternalDataRow(idx)}
                          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    )}

      {template.stages.map((stage, sIdx) => (
        <div key={stage.id} className="bg-white rounded-[2rem] border-l-8 border-orange-600 overflow-hidden shadow-sm border border-gray-100">
          <div className="p-6 bg-orange-50/50 border-b flex justify-between items-center">
            <div className="flex items-center gap-4 flex-1">
              <span className="bg-orange-600 text-white w-10 h-10 flex items-center justify-center rounded-xl font-black">{sIdx + 1}</span>
              <input 
                className="bg-transparent border-b border-orange-200 text-lg font-black outline-none focus:border-orange-600 flex-1 max-w-sm"
                value={stage.name || ''}
                onChange={e => {
                  const newStages = [...template.stages];
                  newStages[sIdx].name = e.target.value;
                  setTemplate({...template, stages: newStages});
                }}
              />
              <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-xl border transition-colors ${stage.allowDivergence !== false ? 'bg-red-50 text-red-600 border-red-100' : 'bg-white border-gray-100 text-gray-400'}`}>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={stage.allowDivergence !== false} 
                  onChange={e => {
                    const newStages = [...template.stages];
                    newStages[sIdx].allowDivergence = e.target.checked;
                    setTemplate({...template, stages: newStages});
                  }} 
                />
                <span className="text-sm">{stage.allowDivergence !== false ? '⚠️' : '⚪'}</span>
                <span className="text-[10px] font-black uppercase">Divergência</span>
              </label>
            </div>
            <button onClick={() => removeStage(sIdx)} className="text-red-500 font-bold text-xs uppercase ml-4">Excluir</button>
          </div>

          <div className="p-6 space-y-4">
            {stage.questions.map((q, qIdx) => (
              <div key={q.id} className="bg-gray-50 p-6 rounded-2xl space-y-4 border border-gray-200">
                <div className="flex gap-4">
                  <div className="bg-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 border">{qIdx + 1}</div>
                  <input
                    className="flex-1 bg-white border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Enunciado da pergunta..."
                    value={q.text || ''}
                    onChange={e => updateQuestion(sIdx, qIdx, { text: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  <div className="flex flex-col">
                    <label className="text-[9px] font-black text-gray-400 uppercase mb-1">Tipo de Resposta</label>
                    <select
                      className="bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold outline-none"
                      value={q.type}
                      onChange={e => updateQuestion(sIdx, qIdx, { type: e.target.value as QuestionType })}
                    >
                      <option value="YES_NO">Sim ou Não</option>
                      <option value="TEXT">Texto Livre</option>
                      <option value="NUMBER">Número/Medição</option>
                      <option value="DATE">Data</option>
                      <option value="MULTIPLE_CHOICE">Múltipla Escolha</option>
                      <option value="IMAGE">Somente Foto</option>
                      <option value="SIGNATURE">Assinatura</option>
                      <option value="OS">Ordem de Serviço (OS)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-center">
                    <label className="flex items-center gap-2 cursor-pointer p-3 bg-white rounded-xl border border-gray-100">
                      <input type="checkbox" checked={q.required} onChange={e => updateQuestion(sIdx, qIdx, { required: e.target.checked })} />
                      <span className="text-[10px] font-black uppercase">Obrigatório</span>
                    </label>
                  </div>

                  <div className="flex flex-col justify-center">
                    <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-xl border transition-colors ${q.allowImage ? 'bg-orange-600 text-white border-orange-600' : 'bg-white border-gray-100'}`}>
                      <input type="checkbox" checked={q.allowImage} onChange={e => updateQuestion(sIdx, qIdx, { allowImage: e.target.checked })} />
                      <span className="text-[10px] font-black uppercase">Solicitar Foto</span>
                    </label>
                  </div>

                  <div className="flex flex-col justify-center">
                    <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-xl border transition-colors ${q.allowNote ? 'bg-orange-600 text-white border-orange-600' : 'bg-white border-gray-100'}`}>
                      <input type="checkbox" checked={q.allowNote} onChange={e => updateQuestion(sIdx, qIdx, { allowNote: e.target.checked })} />
                      <span className="text-[10px] font-black uppercase">Adicionar Obs.</span>
                    </label>
                  </div>

                  <div className="flex flex-col justify-center">
                    <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-xl border transition-colors ${q.autoFill ? 'bg-orange-600 text-white border-orange-600' : 'bg-white border-gray-100'}`}>
                      <input type="checkbox" checked={q.autoFill} onChange={e => updateQuestion(sIdx, qIdx, { autoFill: e.target.checked })} />
                      <span className="text-[10px] font-black uppercase">Auto-preencher</span>
                    </label>
                  </div>
                </div>

                {/* Resposta Padrão */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 space-y-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Resposta Padrão ao abrir Checklist (Opcional)</label>
                  <div className="max-w-md">
                    {q.type === 'YES_NO' && (
                      <div className="flex gap-2">
                        {['Sim', 'Não'].map(opt => (
                          <button
                            key={opt}
                            onClick={() => updateQuestion(sIdx, qIdx, { defaultValue: q.defaultValue === opt ? null : opt })}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase border-2 transition-all ${q.defaultValue === opt ? 'bg-orange-600 text-white border-orange-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                    {(q.type === 'TEXT' || q.type === 'NUMBER' || q.type === 'DATE') && (
                      <input
                        type={q.type === 'NUMBER' ? 'number' : q.type === 'DATE' ? 'date' : 'text'}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-bold outline-none focus:border-orange-500"
                        placeholder="Valor padrão..."
                        value={q.defaultValue || ''}
                        onChange={e => updateQuestion(sIdx, qIdx, { defaultValue: e.target.value })}
                      />
                    )}
                    {q.type === 'MULTIPLE_CHOICE' && (
                      <div className="flex flex-wrap gap-2">
                        {(q.options || []).map(opt => {
                          const isSelected = Array.isArray(q.defaultValue) ? q.defaultValue.includes(opt) : q.defaultValue === opt;
                          return (
                            <button
                              key={opt}
                              onClick={() => {
                                const current = Array.isArray(q.defaultValue) ? q.defaultValue : (q.defaultValue ? [q.defaultValue] : []);
                                const next = current.includes(opt) ? current.filter((v: any) => v !== opt) : [...current, opt];
                                updateQuestion(sIdx, qIdx, { defaultValue: next });
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border-2 transition-all ${isSelected ? 'bg-orange-600 text-white border-orange-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {(q.type === 'IMAGE' || q.type === 'DOCUMENT' || q.type === 'SIGNATURE') && (
                      <p className="text-[9px] text-gray-400 italic">Não disponível para este tipo de resposta.</p>
                    )}
                    {q.type === 'OS' && (
                      <p className="text-[9px] text-blue-400 italic font-black uppercase tracking-widest">Será preenchido com as OS importadas do Excel.</p>
                    )}
                    {q.defaultValue && (
                      <button 
                        onClick={() => updateQuestion(sIdx, qIdx, { defaultValue: null })}
                        className="mt-2 text-[9px] font-black text-red-500 uppercase"
                      >
                        Limpar Padrão
                      </button>
                    )}
                  </div>
                </div>

                {q.type === 'MULTIPLE_CHOICE' && (
                  <div className="p-4 bg-white rounded-xl border border-gray-100 space-y-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Opções de Escolha</p>
                    {(q.options || []).map((opt, optIdx) => (
                      <div key={optIdx} className="flex gap-2">
                        <input className="flex-1 bg-gray-50 border rounded-lg p-2 text-xs" value={opt || ''} onChange={e => {
                          const opts = [...(q.options || [])];
                          opts[optIdx] = e.target.value;
                          updateQuestion(sIdx, qIdx, { options: opts });
                        }} />
                        <button onClick={() => {
                          const opts = [...(q.options || [])];
                          opts.splice(optIdx, 1);
                          updateQuestion(sIdx, qIdx, { options: opts });
                        }} className="text-red-500">×</button>
                      </div>
                    ))}
                    <button onClick={() => updateQuestion(sIdx, qIdx, { options: [...(q.options || []), ''] })} className="text-[10px] font-black text-orange-600 uppercase">+ Opção</button>
                  </div>
                )}
                
                <button onClick={() => {
                   const newStages = [...template.stages];
                   newStages[sIdx].questions.splice(qIdx, 1);
                   setTemplate({...template, stages: newStages});
                }} className="text-red-400 font-bold text-[10px] uppercase">Remover Pergunta</button>
              </div>
            ))}
            <button onClick={() => addQuestion(sIdx)} className="w-full py-4 border-2 border-dashed border-orange-200 rounded-2xl text-orange-600 font-black uppercase text-[10px] hover:bg-orange-50 transition-colors">
              + Adicionar Pergunta
            </button>
          </div>
        </div>
      ))}
      <button onClick={addStage} className="w-full py-4 bg-white border-2 border-gray-200 rounded-2xl font-black uppercase text-[10px] text-gray-400 hover:border-orange-500 hover:text-orange-600 transition-all">+ Nova Etapa</button>
    </div>
  );
};

export default TemplateEditor;
