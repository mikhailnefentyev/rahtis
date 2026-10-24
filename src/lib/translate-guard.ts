/**
 * Защита страницы от автопереводчика браузера.
 *
 * Google Translate (и похожие расширения) подменяет текстовые узлы своими
 * <font>. React об этом не знает и, обновляя страницу, пытается убрать или
 * вставить рядом узел, которого у родителя уже нет, — браузер бросает
 * NotFoundError, и страница падает на экран ошибки. 24.10.2026 так упал
 * новый перевозчик, переводивший немецкие страницы на свой язык: вход,
 * заявка, кабинет, автопарк — пять сбоев за десять минут.
 *
 * Запретить перевод (translate="no") нельзя: водителям и перевозчикам с
 * языком, которого нет в интерфейсе, перевод нужен. Поэтому две операции,
 * на которых React спотыкается, становятся терпимыми: убрать узел, который
 * уже убран, — ничего не делать; вставить перед узлом, которого нет, —
 * вставить в конец. Известное решение из обсуждения React (issue 11538).
 *
 * Строка, а не функция: выполняется в <head> раньше React.
 */
export const TRANSLATE_GUARD = `(function(){
if(typeof Node!=='function'||!Node.prototype||Node.prototype.__rahtisGuard)return;
var p=Node.prototype;p.__rahtisGuard=true;
var rm=p.removeChild;
p.removeChild=function(c){if(c&&c.parentNode!==this)return c;return rm.apply(this,arguments);};
var ins=p.insertBefore;
p.insertBefore=function(n,r){if(r&&r.parentNode!==this)return ins.call(this,n,null);return ins.apply(this,arguments);};
})();`;
