import { motion, AnimatePresence } from "framer-motion";
import { Folder, FolderRoot, X, Check, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { useState, useEffect } from "react";

interface MoveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (destinationFolder: string | null) => void;
    currentFolder: string | null;
    folders: string[]; // List of available folder names
    title?: string;
}

export const MoveModal = ({ isOpen, onClose, onConfirm, currentFolder, folders, title }: MoveModalProps) => {
    const { t } = useTranslation();
    const [selectedFolder, setSelectedFolder] = useState<string | null>(currentFolder);

    useEffect(() => {
        if (isOpen) {
            setSelectedFolder(currentFolder);
        }
    }, [isOpen, currentFolder]);

    // Filter out the current folder from the list
    const availableFolders = folders.filter(f => f !== currentFolder);

    if (!isOpen) return null;

    const isChanged = selectedFolder !== currentFolder;

    return (
        <AnimatePresence>
            <div className="absolute inset-x-0 top-0 z-[60] flex items-start justify-center p-4 min-h-full pointer-events-none">
                {/* Backdrop - theme aware and glassy */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 bg-background/40 dark:bg-black/40 backdrop-blur-[8px] pointer-events-auto"
                    onClick={onClose}
                />
                
                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 40 }}
                    animate={{ opacity: 1, scale: 1, y: 100 }}
                    exit={{ opacity: 0, scale: 0.95, y: 40 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-[440px] bg-card text-card-foreground rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-border/60 overflow-hidden pointer-events-auto"
                >
                    {/* Header - Glassy with theme color */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 bg-muted/30 backdrop-blur-sm">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                                <ArrowRight className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold tracking-tight">
                                    {title || t("app.moveTo") || "移动到"}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">选择目标文件夹位置</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-all active:scale-95"
                        >
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Current location hint - Subtle theme block */}
                    {currentFolder && (
                        <div className="px-6 py-3 border-b border-border/5 bg-accent/5">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground font-medium uppercase tracking-wider">从:</span>
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background border border-border/40 shadow-sm overflow-hidden">
                                    <Folder className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-semibold text-foreground truncate max-w-[200px]">{currentFolder}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Folder List */}
                    <div className="px-4 py-3 max-h-[45vh] overflow-y-auto min-h-[240px] custom-scrollbar"
                        style={{
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'hsl(var(--muted-foreground) / 0.2) transparent',
                        }}
                    >
                        <div className="space-y-1">
                            {/* Root Folder Option */}
                            <button
                                onClick={() => setSelectedFolder(null)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left group border ${
                                    selectedFolder === null
                                        ? "bg-primary/10 border-primary/30 shadow-sm"
                                        : "bg-transparent border-transparent hover:bg-muted/60 hover:border-border/40"
                                }`}
                            >
                                <div className={`flex items-center justify-center w-9 h-9 rounded-xl shadow-sm transition-all ${
                                    selectedFolder === null
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground group-hover:bg-background group-hover:text-foreground"
                                }`}>
                                    <FolderRoot className="h-5 w-5" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <span className={`block text-sm font-semibold truncate ${
                                        selectedFolder === null ? "text-primary" : "text-foreground"
                                    }`}>
                                        {t("app.rootDirectory") || "根目录"}
                                    </span>
                                    <span className="block text-[10px] text-muted-foreground opacity-70">主存储空间根路径</span>
                                </div>
                                {selectedFolder === null && (
                                    <motion.div
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                    </motion.div>
                                )}
                            </button>

                            {/* Section Header */}
                            {availableFolders.length > 0 && (
                                <div className="flex items-center gap-3 py-3 px-4">
                                    <div className="h-px flex-1 bg-border/40" />
                                    <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">文件夹列表</span>
                                    <div className="h-px flex-1 bg-border/40" />
                                </div>
                            )}

                            {/* Existing Folders */}
                            {availableFolders.map((folder) => (
                                <button
                                    key={folder}
                                    onClick={() => setSelectedFolder(folder)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left group border ${
                                        selectedFolder === folder
                                            ? "bg-primary/10 border-primary/30 shadow-sm"
                                            : "bg-transparent border-transparent hover:bg-muted/60 hover:border-border/40"
                                    }`}
                                >
                                    <div className={`flex items-center justify-center w-9 h-9 rounded-xl shadow-sm transition-all ${
                                        selectedFolder === folder
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground group-hover:bg-background group-hover:text-foreground"
                                    }`}>
                                        <Folder className={`h-5 w-5 ${selectedFolder === folder ? "fill-current/20" : ""}`} />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <span className={`block text-sm font-semibold truncate ${
                                            selectedFolder === folder ? "text-primary" : "text-foreground"
                                        }`} title={folder}>
                                            {folder}
                                        </span>
                                    </div>
                                    {selectedFolder === folder && (
                                        <motion.div
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                        </motion.div>
                                    )}
                                </button>
                            ))}

                            {/* Empty state */}
                            {availableFolders.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40 bg-muted/10 rounded-2xl border border-dashed border-border/40">
                                    <Folder className="h-12 w-12 mb-3 opacity-20" />
                                    <p className="text-sm font-medium">{t("app.noOtherFolders") || "没有可选的目标文件夹"}</p>
                                    <p className="text-[10px] mt-1">您可以将文件移动到根目录</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer - Floating style */}
                    <div className="px-6 py-5 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-4">
                        <div className="hidden sm:block">
                            <p className="text-[10px] text-muted-foreground italic">
                                {isChanged ? "已准备好移动" : "未做任何更改"}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="flex-1 sm:flex-none px-6 h-11 rounded-xl text-sm font-bold border-border shadow-sm active:scale-95 transition-all"
                            >
                                {t("app.cancel") || "取消"}
                            </Button>
                            <Button 
                                onClick={() => {
                                    onConfirm(selectedFolder);
                                    onClose();
                                }} 
                                className="flex-1 sm:flex-none px-8 h-11 rounded-xl text-sm font-bold shadow-xl shadow-primary/20 active:scale-95 transition-all"
                                disabled={!isChanged}
                            >
                                {t("app.confirm") || "确认移动"}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
