import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { Button } from "./Button";

interface RenameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (newName: string) => void;
    currentName: string;
    type: "file" | "folder";
}

export const RenameModal = ({ isOpen, onClose, onConfirm, currentName, type }: RenameModalProps) => {
    const { t } = useTranslation();

    // Split file name into base + extension
    const getBaseName = (name: string) => {
        if (type === "folder") return name;
        const dotIndex = name.lastIndexOf(".");
        return dotIndex > 0 ? name.slice(0, dotIndex) : name;
    };

    const getExtension = (name: string) => {
        if (type === "folder") return "";
        const dotIndex = name.lastIndexOf(".");
        return dotIndex > 0 ? name.slice(dotIndex) : "";
    };

    const [baseName, setBaseName] = useState(getBaseName(currentName));
    const [error, setError] = useState("");
    const extension = getExtension(currentName);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setBaseName(getBaseName(currentName));
            setError("");
            // Auto-focus and select text
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.select();
                }
            }, 100);
        }
    }, [isOpen, currentName]);

    const handleConfirm = () => {
        const trimmed = baseName.trim();
        if (trimmed.length === 0) {
            setError(type === "file" ? "文件名不能为空" : "文件夹名不能为空");
            return;
        }
        if (/[\/\\:*?"<>|]/.test(trimmed)) {
            setError("名称包含非法字符");
            return;
        }
        const newName = type === "file" ? trimmed + extension : trimmed;
        if (newName === currentName) {
            onClose();
            return;
        }
        onConfirm(newName);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleConfirm();
        } else if (e.key === "Escape") {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.15 }}
                        className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-border overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 px-6 pt-6 pb-2">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Pencil className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">
                                    {t("file.renameTitle") || "重命名"}
                                </h3>
                                {type === "file" && extension && (
                                    <p className="text-xs text-muted-foreground">
                                        {t("file.renameExtHint") || "文件后缀不可修改"}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Input */}
                        <div className="px-6 py-4">
                            <div className="flex items-center rounded-xl border border-border bg-muted/30 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all overflow-hidden">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="flex-1 px-4 py-3 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                                    placeholder={t("file.renamePlaceholder") || "输入新名称"}
                                    value={baseName}
                                    onChange={(e) => {
                                        setBaseName(e.target.value);
                                        setError("");
                                    }}
                                    onKeyDown={handleKeyDown}
                                />
                                {type === "file" && extension && (
                                    <span className="pr-4 text-sm text-muted-foreground font-medium select-none">
                                        {extension}
                                    </span>
                                )}
                            </div>
                            {error && (
                                <p className="mt-2 text-xs text-red-500 font-medium">{error}</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 px-6 pb-6">
                            <Button
                                variant="ghost"
                                className="rounded-xl px-5"
                                onClick={onClose}
                            >
                                {t("delete.cancel") || "取消"}
                            </Button>
                            <Button
                                className="rounded-xl px-5 bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={handleConfirm}
                            >
                                {t("file.renameConfirm") || "确认"}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
