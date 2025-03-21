import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

export const TablePagination = ({
  page,
  setPage,
  totalPages,
  visiblePageCount = 5,
  className = 'mt-4',
  onPageChange = null,
  siblingCount = 1,
}) => {
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;

    setPage(newPage);

    if (onPageChange && typeof onPageChange === 'function') {
      onPageChange(newPage);
    }
  };

  const getPageNumbers = () => {
    if (totalPages <= visiblePageCount) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const showLeftDots = leftSiblingIndex > 2;
    const showRightDots = rightSiblingIndex < totalPages - 1;

    if (showLeftDots && showRightDots) {
      const middleRange = Array.from(
        { length: rightSiblingIndex - leftSiblingIndex + 1 },
        (_, i) => leftSiblingIndex + i,
      );
      return [
        1,
        showLeftDots ? 'leftEllipsis' : 2,
        ...middleRange,
        showRightDots ? 'rightEllipsis' : totalPages - 1,
        totalPages,
      ];
    }

    if (showLeftDots) {
      const rightRange = Array.from(
        { length: visiblePageCount - 2 },
        (_, i) => totalPages - (visiblePageCount - 2) + i,
      );
      return [1, 'leftEllipsis', ...rightRange];
    }

    if (showRightDots) {
      const leftRange = Array.from(
        { length: visiblePageCount - 2 },
        (_, i) => i + 1,
      );
      return [...leftRange, 'rightEllipsis', totalPages];
    }

    return Array.from({ length: visiblePageCount }, (_, i) => i + 1);
  };

  if (!totalPages || totalPages <= 1) return null;

  const pageNumbers = getPageNumbers();

  return (
    <>
      <Pagination className={className}>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => handlePageChange(currentPage - 1)}
              className={
                currentPage === 1
                  ? 'pointer-events-none opacity-50'
                  : 'cursor-pointer'
              }
              aria-disabled={currentPage === 1}
              tabIndex={currentPage === 1 ? -1 : 0}
            />
          </PaginationItem>

          {/* Page Numbers */}
          {pageNumbers.map((pageNumber) => {
            if (
              pageNumber === 'leftEllipsis' ||
              pageNumber === 'rightEllipsis'
            ) {
              return (
                <PaginationItem key={`ellipsis-${pageNumber}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }

            return (
              <PaginationItem key={pageNumber}>
                <PaginationLink
                  onClick={() => handlePageChange(pageNumber)}
                  isActive={currentPage === pageNumber}
                  className="cursor-pointer"
                  aria-current={currentPage === pageNumber ? 'page' : undefined}
                >
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            );
          })}

          <PaginationItem>
            <PaginationNext
              onClick={() => handlePageChange(currentPage + 1)}
              className={
                currentPage === totalPages
                  ? 'pointer-events-none opacity-50'
                  : 'cursor-pointer'
              }
              aria-disabled={currentPage === totalPages}
              tabIndex={currentPage === totalPages ? -1 : 0}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </>
  );
};
