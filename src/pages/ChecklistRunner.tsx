
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChecklistTemplate, ChecklistResponse, Stage, Question, ExternalDataRow } from '../types';
import { supabaseService } from '../services/supabaseService';
import { generateChecklistPDF } from '../utils/pdfGenerator';
import { resizeImage } from '../utils/imageUtils';

interface SignatureModalProps {
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

const SignatureModal: React.FC<SignatureModalProps> = ({ onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }, []);

  const getCoords = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: any) => {
    setIsDrawing(true);
    const { x, y } = getCoords(e);
    canvasRef.current?.getContext('2d')?.beginPath();
    canvasRef.current?.getContext('2d')?.moveTo(x, y);
    if (e.cancelable) e.preventDefault();
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const { x, y } = getCoords(e);
    canvasRef.current?.getContext('2d')?.lineTo(x, y);
    canvasRef.current?.getContext('2d')?.stroke();
    if (e.cancelable) e.preventDefault();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-black uppercase tracking-tighter text-gray-900">Assinatura Digital</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 font-black">✕</button>
        </div>
        <div className="flex-1 bg-white relative min-h-[300px] border-b-2 border-dashed border-gray-100 overflow-hidden">
          <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} className="absolute inset-0 touch-none w-full h-full" />
        </div>
        <div className="p-6 bg-gray-50 flex gap-3">
          <button onClick={() => { const c = canvasRef.current; c?.getContext('2d')?.clearRect(0,0,c.width,c.height); }} className="flex-1 py-4 rounded-2xl bg-white border-2 border-gray-200 text-gray-500 font-black text-[10px] uppercase">Limpar</button>
          <button onClick={() => onSave(canvasRef.current?.toDataURL('image/png') || '')} className="flex-1 py-4 rounded-2xl bg-orange-600 text-white font-black text-[10px] uppercase shadow-lg">Confirmar</button>
        </div>
      </div>
    </div>
  );
};

const ChecklistRunner: React.FC<{ template: ChecklistTemplate, onBack: () => void, editId?: string }> = ({ template, onBack, editId }) => {
  const [response, setResponse] = useState<ChecklistResponse>(() => {
    const today = new Date().toISOString().split('T')[0];
    const initialData: Record<string, any> = {};
    
    // Pre-fill for NEW responses
    if (!editId) {
      template.stages.forEach(stage => {
        stage.questions.forEach(q => {
          let valToFill = null;
          if (q.type === 'DATE' && q.autoFill) {
            valToFill = today;
          } else if (q.defaultValue !== undefined && q.defaultValue !== null) {
            valToFill = q.defaultValue;
          }

          if (valToFill !== null) {
            if (!initialData[stage.id]) initialData[stage.id] = {};
            initialData[stage.id][q.id] = { val: valToFill, imgs: [], docs: [], note: '' };
          }
        });
      });
    }

    return {
      id: editId || `res_${Math.random().toString(36).substr(2, 9)}`,
      templateId: template.id,
      customId: '',
      status: 'DRAFT',
      currentStageId: template.stages[0].id,
      data: initialData,
      stageTimeSpent: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [signatureTarget, setSignatureTarget] = useState<{ stageId: string, qId: string } | null>(null);
  const [finalizeProgress, setFinalizeProgress] = useState('');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  
  const stageStartTimeRef = useRef(Date.now());
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgressRef = useRef<Promise<any> | null>(null);
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (response.status === 'DRAFT' && dataLoadedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [response.status]);

  useEffect(() => {
    if (template) {
      console.log("ChecklistRunner: Template carregado:", template.title);
      console.log("ChecklistRunner: Dados Externos (OS):", template.externalData?.length || 0, "registros");
    }
  }, [template]);

  useEffect(() => {
    if (editId) {
      setLoading(true);
      supabaseService.getResponseById(editId).then(existing => {
        if (existing) {
          if (existing.status === 'DRAFT') {
            const today = new Date().toISOString().split('T')[0];
            let hasChanges = false;
            const newData = { ...existing.data };
            
            template.stages.forEach(stage => {
              stage.questions.forEach(q => {
                const currentVal = newData[stage.id]?.[q.id]?.val ?? newData[stage.id]?.[q.id];
                let valToFill = null;

                if (q.type === 'DATE' && q.autoFill && !currentVal) {
                  valToFill = today;
                } else if (q.defaultValue !== undefined && q.defaultValue !== null && !currentVal) {
                  valToFill = q.defaultValue;
                }

                if (valToFill !== null) {
                  if (!newData[stage.id]) newData[stage.id] = {};
                  newData[stage.id][q.id] = { val: valToFill, imgs: [], docs: [], note: '' };
                  hasChanges = true;
                }
              });
            });
            
            if (hasChanges) {
              existing.data = newData;
            }
          }
          
          setResponse(existing);
          const sIdx = template.stages.findIndex(s => s.id === existing.currentStageId);
          if (sIdx >= 0) setCurrentStageIdx(sIdx);
        }
        dataLoadedRef.current = true;
        setLoading(false);
      }).catch(err => {
        console.error("Erro ao carregar checklist:", err);
        dataLoadedRef.current = true;
        setLoading(false);
      });
    } else {
      dataLoadedRef.current = true;
    }
  }, [editId, template]);

  const persistData = async (options?: { forceTimeUpdate?: boolean, finalStatus?: 'DRAFT' | 'COMPLETED', pdfUrl?: string, customData?: any }) => {
    if (!dataLoadedRef.current) return;

    if (!options?.finalStatus && saveInProgressRef.current) {
      await saveInProgressRef.current;
    }

    const performSave = async () => {
      setIsSaving(true);
      const updatedTime = { ...(response.stageTimeSpent || {}) };
      
      if (options?.forceTimeUpdate) {
        const stageId = template.stages[currentStageIdx].id;
        updatedTime[stageId] = (updatedTime[stageId] || 0) + (Date.now() - stageStartTimeRef.current);
        stageStartTimeRef.current = Date.now();
      }

      const dataToSave: ChecklistResponse = {
        ...response,
        data: options?.customData || response.data,
        status: options?.finalStatus || response.status,
        stageTimeSpent: updatedTime,
        currentStageId: template.stages[currentStageIdx].id,
        updatedAt: new Date().toISOString(),
        completedAt: options?.finalStatus === 'COMPLETED' ? new Date().toISOString() : response.completedAt,
        pdfUrl: options?.pdfUrl !== undefined ? options.pdfUrl : response.pdfUrl
      };

      try {
        await supabaseService.saveResponse(dataToSave);
        setResponse(dataToSave);
        if (options?.forceTimeUpdate) {
          setSaveMessage({ type: 'success', text: 'Alterações salvas!' });
          setTimeout(() => setSaveMessage(null), 2000);
        }
        return dataToSave;
      } catch (err: any) {
        console.error("Erro ao persistir checklist:", err);
        throw err;
      } finally {
        setIsSaving(false);
        saveInProgressRef.current = null;
      }
    };

    saveInProgressRef.current = performSave();
    return saveInProgressRef.current;
  };

  useEffect(() => {
    if (!dataLoadedRef.current) return;
    const osNum = response.externalDataRow?.os;
    if (!osNum) return;

    let changed = false;
    const newData = { ...response.data };

    template.stages.forEach(stage => {
      stage.questions.forEach(q => {
        if (q.type === 'OS') {
          const currentVal = newData[stage.id]?.[q.id]?.val;
          if (currentVal !== osNum) {
            if (!newData[stage.id]) newData[stage.id] = {};
            if (!newData[stage.id][q.id]) newData[stage.id][q.id] = { val: null, imgs: [], docs: [], note: '' };
            newData[stage.id][q.id] = { ...newData[stage.id][q.id], val: osNum };
            changed = true;
          }
        }
      });
    });

    if (changed) {
      setResponse(prev => ({ ...prev, data: newData }));
    }
  }, [response.externalDataRow?.os, template.stages]);

  useEffect(() => {
    if (response.status === 'COMPLETED' || !dataLoadedRef.current) return;
    
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      persistData().catch((err) => {
        console.error("Auto-save failed:", err);
      });
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [response.data, response.customId, response.externalDataRow, currentStageIdx]);

  const getQData = (data: any, stageId: string, qId: string) => {
    const d = data[stageId]?.[qId];
    return (d && typeof d === 'object' && 'val' in d) ? d : { val: d || null, imgs: [], docs: [], note: '' };
  };

  const isQuestionEmpty = (q: Question, stageId: string) => {
    if (!q.required) return false;
    const data = getQData(response.data, stageId, q.id);
    switch (q.type) {
      case 'IMAGE': return !data.imgs || data.imgs.length === 0;
      case 'DOCUMENT': return !data.docs || data.docs.length === 0;
      case 'MULTIPLE_CHOICE': return Array.isArray(data.val) ? data.val.length === 0 : !data.val;
      case 'SIGNATURE': return !data.val;
      default: return data.val === null || data.val === undefined || String(data.val).trim() === '';
    }
  };

  const updateQ = (qId: string, updates: any) => {
    if (response.status === 'COMPLETED') return;
    setResponse(prev => {
      const stageId = currentStage.id;
      const currentData = prev.data[stageId]?.[qId];
      const normalizedData = (currentData && typeof currentData === 'object' && 'val' in currentData) 
        ? currentData 
        : { val: currentData || null, imgs: [], docs: [], note: '' };

      return {
        ...prev,
        data: {
          ...prev.data,
          [stageId]: { 
            ...(prev.data[stageId] || {}), 
            [qId]: { ...normalizedData, ...updates } 
          }
        }
      };
    });
  };

  const handleImageUpload = async (qId: string, files: FileList | null) => {
    if (!files) return;
    
    setLoading(true);
    try {
      const newImgs: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        const base64 = await new Promise<string>(resolve => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(files[i]);
        });
        
        // Redimensionar para 800px para manter o rascunho leve
        const resized = await resizeImage(base64, 800, 800);
        newImgs.push(resized);
      }
      
      setResponse(prev => {
        const stageId = currentStage.id;
        const currentData = prev.data[stageId]?.[qId];
        const normalizedData = (currentData && typeof currentData === 'object' && 'val' in currentData) 
          ? currentData 
          : { val: currentData || null, imgs: [], docs: [], note: '' };

        return {
          ...prev,
          data: {
            ...prev.data,
            [stageId]: { 
              ...(prev.data[stageId] || {}), 
              [qId]: { 
                ...normalizedData, 
                imgs: [...(normalizedData.imgs || []), ...newImgs] 
              } 
            }
          }
        };
      });
    } catch (err) {
      console.error("Erro ao processar imagens:", err);
      alert("Erro ao processar imagens. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleDocUpload = async (qId: string, files: FileList | null) => {
    if (!files) return;
    
    const newDocs = Array.from(files).map(file => ({
      name: file.name,
      type: file.type,
      lastModified: file.lastModified
    }));

    setResponse(prev => {
      const stageId = currentStage.id;
      const currentData = prev.data[stageId]?.[qId];
      const normalizedData = (currentData && typeof currentData === 'object' && 'val' in currentData) 
        ? currentData 
        : { val: currentData || null, imgs: [], docs: [], note: '' };

      return {
        ...prev,
        data: {
          ...prev.data,
          [stageId]: { 
            ...(prev.data[stageId] || {}), 
            [qId]: { 
              ...normalizedData, 
              docs: [...(normalizedData.docs || []), ...newDocs] 
            } 
          }
        }
      };
    });
  };

  const handleExit = async () => {
    try {
      setLoading(true);
      setFinalizeProgress('Garantindo salvamento...');
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      await persistData({ forceTimeUpdate: true });
      setLoading(false);
      onBack();
    } catch (err: any) {
      setLoading(false);
      alert("⚠️ Erro ao salvar rascunho. Verifique sua conexão.");
    }
  };

  const handleFinalize = async () => {
    if (!response.customId || !response.customId.trim()) {
      setShowErrors(true);
      return alert("O ID DO CHECKLIST é obrigatório.");
    }
    
    for (let i = 0; i < template.stages.length; i++) {
      const stage = template.stages[i];
      const empty = stage.questions.filter(q => isQuestionEmpty(q, stage.id));
      if (empty.length > 0) {
        setShowErrors(true);
        setCurrentStageIdx(i);
        alert(`A etapa "${stage.name}" possui campos obrigatórios incompletos.`);
        return;
      }
    }

    if (!confirm("Confirmar finalização do checklist?")) return;

    setLoading(true);
    setFinalizeProgress('Preparando arquivos...');

    let finalPdfUrl = '';
    const updatedData = JSON.parse(JSON.stringify(response.data));

    try {
      // 1. Upload de Imagens e Assinaturas para o Storage
      setFinalizeProgress('Enviando fotos e assinaturas...');
      
      for (const stageId in updatedData) {
        for (const qId in updatedData[stageId]) {
          const qData = updatedData[stageId][qId];
          const question = template.stages.find(s => s.id === stageId)?.questions.find(q => q.id === qId);
          
          if (!question) continue;

          // Upload de Imagens
          if (qData.imgs && qData.imgs.length > 0) {
            const uploadedImgs = [];
            for (let i = 0; i < qData.imgs.length; i++) {
              const img = qData.imgs[i];
              if (img.startsWith('data:image')) {
                const path = `${response.id}/${qId}_img_${i}_${Date.now()}.jpg`;
                const url = await supabaseService.uploadFile('responses', path, img);
                uploadedImgs.push(url || img);
              } else {
                uploadedImgs.push(img);
              }
            }
            updatedData[stageId][qId].imgs = uploadedImgs;
          }

          // Upload de Assinatura
          if (question.type === 'SIGNATURE' && qData.val && qData.val.startsWith('data:image')) {
            const path = `${response.id}/${qId}_signature_${Date.now()}.png`;
            const url = await supabaseService.uploadFile('responses', path, qData.val);
            updatedData[stageId][qId].val = url || qData.val;
          }
        }
      }

      // Atualiza o estado local com as URLs antes de gerar o PDF
      const responseWithUrls = { ...response, data: updatedData };

      // 2. Gera PDF
      try {
        if ((window as any).jspdf) {
          setFinalizeProgress('Gerando relatório PDF...');
          const doc = generateChecklistPDF(responseWithUrls, template);
          const pdfBlob = doc.output('blob');
          
          setFinalizeProgress('Enviando PDF para o servidor...');
          const pdfPath = `report_${response.id}_${Date.now()}.pdf`;
          const url = await supabaseService.uploadFile('responses', pdfPath, pdfBlob);
          finalPdfUrl = url || '';

          // --- OneDrive Upload ---
          try {
            const reader = new FileReader();
            reader.readAsDataURL(pdfBlob);
            reader.onloadend = async () => {
              const base64data = (reader.result as string).split(',')[1];
              const d = new Date(response.updatedAt);
              const dateStr = d.toISOString().split('T')[0];
              const filename = `${response.customId || 'REG'}_${template.title}_${dateStr}`.replace(/[^a-z0-9_-]/gi, '_') + '.pdf';

              setFinalizeProgress('Sincronizando com OneDrive...');
              await fetch('/api/onedrive/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileName: filename,
                  fileContent: base64data
                })
              });
            };
          } catch (oneDriveErr) {
            console.error("Erro ao enviar para OneDrive:", oneDriveErr);
          }
        }
      } catch (pdfErr) {
        console.warn("PDF não gerado ou erro no upload:", pdfErr);
      }

      // 3. SALVAMENTO FINAL: Muda status para COMPLETED e grava no DB
      setFinalizeProgress('Finalizando registro...');
      await persistData({ 
        forceTimeUpdate: true, 
        finalStatus: 'COMPLETED', 
        pdfUrl: finalPdfUrl,
        customData: updatedData
      });

      // 4. REMOVE OS DO TEMPLATE (SE EXISTIR)
      if (response.externalDataRow) {
        setFinalizeProgress('Atualizando lista de OS...');
        try {
          const templates = await supabaseService.getTemplates();
          const latestTemplate = templates.find(t => t.id === template.id);
          if (latestTemplate && latestTemplate.externalData) {
            const updatedExternalData = latestTemplate.externalData.filter(row => row.os !== response.externalDataRow?.os);
            await supabaseService.saveTemplate({
              ...latestTemplate,
              externalData: updatedExternalData
            });
          }
        } catch (templateErr) {
          console.error("Erro ao remover OS do template:", templateErr);
        }
      }

      setLoading(false);
      onBack();
    } catch (err: any) {
      console.error("Erro ao finalizar:", err);
      alert(`⚠️ Falha ao finalizar checklist: ${err.message || 'Erro desconhecido'}`);
      setLoading(false);
    }
  };

  const currentStage = template.stages[currentStageIdx];
  const currentQData = (qId: string) => getQData(response.data, currentStage.id, qId);

  const handleOSSelect = (osNum: string) => {
    const row = template.externalData?.find(r => r.os === osNum);
    if (row) {
      setResponse(prev => ({
        ...prev,
        customId: row.os,
        externalDataRow: row
      }));
    } else {
      setResponse(prev => ({
        ...prev,
        externalDataRow: undefined
      }));
    }
  };

  const hasOSQuestion = useMemo(() => {
    return template.stages.some(s => s.questions.some(q => q.type === 'OS'));
  }, [template.stages]);

  return (
    <div className="space-y-6 pb-32 animate-fadeIn max-w-4xl mx-auto px-2">
      {loading && (
        <div className="fixed inset-0 z-[200] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center text-orange-600">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
          <p className="font-black uppercase tracking-widest text-[10px] text-center px-6">{finalizeProgress || 'Carregando rascunho...'}</p>
        </div>
      )}

      <header className="flex justify-between items-center sticky top-0 bg-gray-50/95 py-3 z-30 border-b px-2 backdrop-blur-sm">
        <button onClick={handleExit} className="text-orange-600 font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform">← Salvar e Sair</button>
        <div className="text-center">
          <h2 className="text-xs font-black uppercase text-gray-900 line-clamp-1">{template.title}</h2>
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{currentStage.name} ({currentStageIdx + 1}/{template.stages.length})</p>
        </div>
        <div className="flex items-center gap-2 min-w-[60px] justify-end">
          {saveMessage && (
            <span className={`text-[8px] font-black uppercase tracking-widest animate-fadeIn ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {saveMessage.text}
            </span>
          )}
          <button 
            onClick={() => persistData({ forceTimeUpdate: true })}
            disabled={isSaving || !dataLoadedRef.current}
            className="text-[10px] font-black text-orange-600 uppercase tracking-widest hover:underline disabled:opacity-50"
          >
            {isSaving ? 'Gravando...' : '💾 Salvar'}
          </button>
        </div>
      </header>

      {template.externalData && template.externalData.length > 0 && !hasOSQuestion && (
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100 space-y-4">
          <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Selecionar OS do Carregamento</label>
          <select 
            className="w-full border-2 border-blue-50 rounded-2xl p-4 font-black uppercase outline-none focus:border-blue-500 bg-blue-50/30"
            value={response.externalDataRow?.os || ''}
            onChange={e => handleOSSelect(e.target.value)}
          >
            <option value="">Selecione uma OS...</option>
            {template.externalData.map(row => (
              <option key={row.os} value={row.os}>{row.os} - {row.cliente}</option>
            ))}
          </select>
          
          {response.externalDataRow && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
              <div>
                <p className="text-[8px] font-black text-blue-400 uppercase">Programa</p>
                <p className="text-[10px] font-black text-blue-900 uppercase">{response.externalDataRow.tipo_programa}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-blue-400 uppercase">Galpão</p>
                <p className="text-[10px] font-black text-blue-900 uppercase">{response.externalDataRow.cod_galpao} - {response.externalDataRow.desc_galpao}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[8px] font-black text-blue-400 uppercase">Cliente</p>
                <p className="text-[10px] font-black text-blue-900 uppercase">{response.externalDataRow.cliente}</p>
              </div>
            </div>
          )}
        </section>
      )}

      <section className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${showErrors && !response.customId ? 'border-red-500 ring-2 ring-red-50' : 'border-orange-100'}`}>
        <label className="block text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">ID DO CHECKLIST (OBRIGATÓRIO)</label>
        <input type="text" className={`w-full border-2 rounded-2xl p-4 font-black uppercase outline-none focus:border-orange-500 transition-colors ${showErrors && !response.customId ? 'border-red-200 bg-red-50' : 'border-gray-50'}`} placeholder={template.customIdPlaceholder || "EX: VEÍCULO-01"} value={response.customId} onChange={e => setResponse({...response, customId: e.target.value.toUpperCase()})} />
      </section>

      <div className="space-y-4">
        {currentStage.questions.map(q => {
          const data = currentQData(q.id);
          const hasError = showErrors && isQuestionEmpty(q, currentStage.id);
          return (
            <div key={q.id} className={`p-6 bg-white rounded-3xl border-2 transition-all ${hasError ? 'border-red-500 ring-4 ring-red-50 bg-red-50/10' : 'border-gray-50 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-4">
                <label className="block font-black text-gray-900 text-sm uppercase tracking-tight">{q.text} {q.required && <span className="text-red-500">*</span>}</label>
              </div>
              
              <div className="space-y-3">
                {q.type === 'YES_NO' && (
                  <div className="flex gap-3">
                    {['Sim', 'Não'].map(opt => (
                      <button key={opt} onClick={() => updateQ(q.id, { val: opt })} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase border-2 transition-all ${data.val === opt ? 'bg-orange-600 text-white border-orange-600 shadow-lg' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>{opt}</button>
                    ))}
                  </div>
                )}
                
                {q.type === 'TEXT' && <textarea className="w-full rounded-2xl border-2 border-gray-100 p-4 text-sm font-bold outline-none focus:border-orange-500" placeholder="Escreva aqui..." value={data.val || ''} onChange={e => updateQ(q.id, { val: e.target.value })} />}
                {q.type === 'NUMBER' && <input type="number" className="w-full rounded-2xl border-2 border-gray-100 p-4 text-sm font-bold outline-none focus:border-orange-500" value={data.val || ''} onChange={e => updateQ(q.id, { val: e.target.value })} />}
                {q.type === 'DATE' && <input type="date" className="w-full rounded-2xl border-2 border-gray-100 p-4 text-sm font-bold outline-none focus:border-orange-500" value={data.val || ''} onChange={e => updateQ(q.id, { val: e.target.value })} />}
                
                {q.type === 'OS' && (
                  <div className="space-y-3">
                    <select 
                      className="w-full border-2 border-gray-100 rounded-2xl p-4 font-black uppercase outline-none focus:border-orange-500 bg-gray-50"
                      value={data.val || ''}
                      onChange={e => {
                        const val = e.target.value;
                        updateQ(q.id, { val });
                        handleOSSelect(val);
                      }}
                    >
                      <option value="">Selecione uma OS...</option>
                      {(template.externalData || []).map(row => (
                        <option key={row.os} value={row.os}>{row.os} - {row.cliente}</option>
                      ))}
                    </select>
                    {data.val && template.externalData?.find(r => r.os === data.val) && (
                      <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-[10px] font-black uppercase text-blue-900 space-y-1">
                        {(() => {
                          const row = template.externalData.find(r => r.os === data.val);
                          return row ? (
                            <>
                              <p><span className="text-blue-400">Programa:</span> {row.tipo_programa}</p>
                              <p><span className="text-blue-400">Galpão:</span> {row.cod_galpao} - {row.desc_galpao}</p>
                              <p><span className="text-blue-400">Cliente:</span> {row.cliente}</p>
                            </>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {q.type === 'MULTIPLE_CHOICE' && (
                  <div className="flex flex-wrap gap-2">
                    {(q.options || []).map(opt => {
                      const sel = Array.isArray(data.val) ? data.val.includes(opt) : data.val === opt;
                      return (
                        <button key={opt} onClick={() => {
                          const curr = Array.isArray(data.val) ? data.val : (data.val ? [data.val] : []);
                          const next = curr.includes(opt) ? curr.filter((v:any) => v !== opt) : [...curr, opt];
                          updateQ(q.id, { val: next });
                        }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${sel ? 'bg-orange-600 text-white border-orange-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>{opt}</button>
                      );
                    })}
                  </div>
                )}
                
                {q.type === 'SIGNATURE' && (
                   <div className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center border-2 border-dashed border-gray-200">
                      {data.val ? <img src={data.val} className="max-h-24" /> : <p className="text-[10px] font-black text-gray-300 uppercase italic">Aguardando assinatura</p>}
                      <button onClick={() => setSignatureTarget({ stageId: currentStage.id, qId: q.id })} className="mt-3 text-orange-600 font-black text-[9px] uppercase tracking-widest">🖊️ Abrir Painel</button>
                   </div>
                )}

                {q.type === 'DOCUMENT' && (
                  <div className="space-y-2">
                    <label className="cursor-pointer flex items-center justify-center p-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase gap-2 shadow-lg">
                      <span>📁 Selecionar Arquivos</span>
                      <input type="file" className="hidden" multiple onChange={e => handleDocUpload(q.id, e.target.files)} />
                    </label>
                    {data.docs?.length > 0 && (
                      <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                        {data.docs.map((d:any, idx:number) => (
                          <p key={idx} className="text-[9px] font-bold text-gray-500 truncate">📄 {d.name}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(q.type === 'IMAGE' || q.allowImage) && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <label className="flex-1 cursor-pointer flex items-center justify-center p-4 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase gap-2 shadow-lg active:scale-95 transition-transform">
                        <span>📸 Câmera</span>
                        <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => handleImageUpload(q.id, e.target.files)} />
                      </label>
                      <label className="flex-1 cursor-pointer flex items-center justify-center p-4 bg-gray-100 text-gray-600 rounded-2xl border-2 border-gray-200 font-black text-[10px] uppercase gap-2 active:scale-95 transition-transform">
                        <span>🖼️ Galeria</span>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={e => handleImageUpload(q.id, e.target.files)} />
                      </label>
                    </div>
                    {data.imgs?.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 pt-2">
                        {data.imgs.map((img:string, i:number) => (
                          <div key={i} className="relative aspect-square">
                            <img src={img} className="w-full h-full object-cover rounded-xl border border-gray-100 shadow-sm" onClick={() => setPreviewImage(img)} />
                            <button onClick={(e) => { e.stopPropagation(); const n = [...data.imgs]; n.splice(i, 1); updateQ(q.id, { imgs: n }); }} className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full text-[12px] flex items-center justify-center font-bold">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {q.allowNote && <input className="w-full bg-gray-50 border-none rounded-xl p-3 text-[10px] font-bold" placeholder="Observação..." value={data.note || ''} onChange={e => updateQ(q.id, { note: e.target.value })} />}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t z-50">
        <div className="max-w-4xl mx-auto flex gap-3">
          {currentStageIdx > 0 && <button onClick={() => setCurrentStageIdx(currentStageIdx - 1)} className="flex-1 py-4 rounded-2xl bg-white border-2 border-gray-200 font-black text-[10px] uppercase tracking-widest">Anterior</button>}
          {currentStageIdx < template.stages.length - 1 ? (
            <button onClick={async () => { await persistData({forceTimeUpdate:true}); setCurrentStageIdx(currentStageIdx+1); setShowErrors(false); }} className="flex-1 py-4 rounded-2xl bg-orange-600 text-white font-black text-[10px] uppercase shadow-lg tracking-widest">Próximo</button>
          ) : (
            <button onClick={handleFinalize} className="flex-1 py-4 rounded-2xl bg-green-600 text-white font-black text-[10px] uppercase shadow-xl tracking-widest animate-pulse">Finalizar</button>
          )}
        </div>
      </footer>

      {previewImage && <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}><img src={previewImage} className="max-w-full max-h-full rounded-2xl shadow-2xl" /></div>}
      {signatureTarget && <SignatureModal onClose={() => setSignatureTarget(null)} onSave={val => { updateQ(signatureTarget.qId, { val }); setSignatureTarget(null); }} />}
    </div>
  );
};

export default ChecklistRunner;
