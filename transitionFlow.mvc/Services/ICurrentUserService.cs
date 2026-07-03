using TransitFlow.mvc.Models;

namespace TransitFlow.mvc.Services
{
    public interface ICurrentUserService
    {
        HomeUserModel? GetUser();
    }
}